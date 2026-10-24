"use client";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { MarkWatchedSheet } from "@/components/MarkWatchedSheet";
import type { Platform } from "@/db";
import { cn } from "@/lib/cn";
import { PICKS_SAVE_LABEL } from "@/lib/mark-seen";
import {
  resolveStubRelease,
  STUB_HINT_MS,
  STUB_TAP_SLOP_PX,
  STUB_TEAR_PX,
} from "@/lib/tonight/stub-gesture";
import { focusRing } from "@/lib/ui";

export { STUB_TEAR_PX };
const STUB_MAX_PX = 96;
const STUB_BREATH_DELAY_MS = 1200;
const STUB_BREATH_MS = 700;
const BREATH_STORAGE_KEY = "filmia:stub-breath";

/** True once per local day: the first hero teaches the pull, the rest stay still. */
const claimDailyBreath = () => {
  try {
    const today = new Date().toDateString();
    if (window.localStorage.getItem(BREATH_STORAGE_KEY) === today) {
      return false;
    }
    window.localStorage.setItem(BREATH_STORAGE_KEY, today);
    return true;
  } catch {
    return false;
  }
};

type TicketStubProps = {
  titleId: string;
  titleName: string;
  rating?: number | null;
  review?: string | null;
  /**
   * The card's platform (FIL-I21-1): «Vi esto» opens with that chip marked. Leave it
   * undefined when the card has none, so the sheet starts on NINGUNA and sends nothing.
   */
  platform?: Platform | null;
  /**
   * First hero of the day (FIL-I21-2): the stub dips 8 px once at 1.2 s so the pull is taught
   * without words. Once per day (localStorage), never with prefers-reduced-motion.
   */
  breathe?: boolean;
  /** Fires once when the tear commits (light-leak hook). */
  onCommit?: () => void;
  onSaved?: () => void;
  onError?: (message: string) => void;
  /**
   * A recommendation has no title yet: «Marqué visto» creates it with the form, and the stub
   * plays its exit only once that save lands (undo, rutas and Universo need the new title).
   * Resolves to an error message, or null when it saved.
   */
  saveSeen?: (formData: FormData) => Promise<string | null>;
  className?: string;
};

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const haptic = (ms: number) => {
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    navigator.vibrate(ms);
  }
};

/**
 * Talón de boleto under the hero poster: drag it down (the perforation opens
 * at 60 px) or tap it to open «Marqué visto». A real button for keyboard/SR.
 */
export const TicketStub = ({
  titleId,
  titleName,
  rating = null,
  review = null,
  platform,
  breathe = false,
  onCommit,
  onSaved,
  onError,
  saveSeen,
  className,
}: TicketStubProps) => {
  const [open, setOpen] = useState(false);
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [torn, setTorn] = useState(false);
  // A half-hearted pull (12–59 px) springs back and shows «Arranca hasta el fondo» a moment.
  const [nudged, setNudged] = useState(false);
  const nudgeTimer = useRef<number | null>(null);
  const [breathing, setBreathing] = useState(false);
  const startY = useRef(0);
  const travel = useRef(0);
  const armed = useRef(false);
  // A tap fires pointerdown → pointerup before React commits `dragging`; track it in a ref.
  const active = useRef(false);

  useEffect(() => {
    if (!open) {
      armed.current = false;
    }
  }, [open]);

  useEffect(
    () => () => {
      if (nudgeTimer.current != null) {
        window.clearTimeout(nudgeTimer.current);
      }
    },
    [],
  );

  // Once claimed, this instance keeps the claim (StrictMode re-runs the effect in dev).
  const breathClaimed = useRef(false);
  useEffect(() => {
    if (!breathe || prefersReducedMotion()) {
      return;
    }
    if (!breathClaimed.current) {
      if (!claimDailyBreath()) {
        return;
      }
      breathClaimed.current = true;
    }
    // Deferred so the first paint is the resting stub; the CSS delay does the 1.2 s wait.
    const start = window.setTimeout(() => setBreathing(true), 0);
    const stop = window.setTimeout(() => setBreathing(false), STUB_BREATH_DELAY_MS + STUB_BREATH_MS);
    return () => {
      window.clearTimeout(start);
      window.clearTimeout(stop);
    };
  }, [breathe]);

  const openSheet = () => {
    onCommit?.();
    setTorn(true);
    setOpen(true);
  };

  const reset = () => {
    setOffset(0);
    setTorn(false);
    armed.current = false;
  };

  /** Spring back and hint for a moment: the pull was too short to tear (visual, iPhone web has no haptics). */
  const springBack = () => {
    reset();
    setNudged(true);
    if (nudgeTimer.current != null) {
      window.clearTimeout(nudgeTimer.current);
    }
    nudgeTimer.current = window.setTimeout(() => setNudged(false), STUB_HINT_MS);
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || open) {
      return;
    }
    // Keep the deck from starting a horizontal drag.
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    startY.current = event.clientY;
    travel.current = 0;
    armed.current = false;
    active.current = true;
    setNudged(false);
    setDragging(true);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!active.current) {
      return;
    }
    event.stopPropagation();
    // The mouse came back with its button already up (released outside the page): that was the release.
    if (event.pointerType === "mouse" && event.buttons === 0) {
      finishDrag();
      return;
    }
    if (prefersReducedMotion()) {
      return;
    }
    const dy = Math.min(STUB_MAX_PX, Math.max(0, event.clientY - startY.current));
    travel.current = dy;
    const nowArmed = dy >= STUB_TEAR_PX;
    if (nowArmed && !armed.current) {
      haptic(12);
    }
    armed.current = nowArmed;
    setOffset(dy);
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!active.current) {
      return;
    }
    event.stopPropagation();
    finishDrag();
  };

  /**
   * Decides a drag by how far it went. Also runs when the release never reaches the stub (let go
   * outside the page, capture lost): otherwise it stays pulled with «Suelta para…» forever.
   */
  const finishDrag = () => {
    if (!active.current) {
      return;
    }
    active.current = false;
    setDragging(false);
    // Only pointerup decides; a finger slides a few px on every tap, so 12 px still count as one.
    const release = resolveStubRelease(travel.current);
    if (release === "tap" || release === "tear") {
      haptic(release === "tear" ? 20 : 0);
      setOffset(release === "tear" ? STUB_TEAR_PX + 18 : 0);
      openSheet();
      return;
    }
    springBack();
  };

  /** Scroll took over or the finger left the screen: never opens, never stays armed. */
  const handlePointerCancel = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!active.current) {
      return;
    }
    active.current = false;
    event.stopPropagation();
    setDragging(false);
    reset();
  };

  // Capture lost without a pointerup (it also fires after a normal one, when `active` is already off).
  const handleLostPointerCapture = () => finishDrag();

  // The window lost focus mid-drag: no release will come, spring back.
  useEffect(() => {
    if (!dragging) {
      return;
    }
    const cancel = () => {
      if (!active.current) {
        return;
      }
      active.current = false;
      setDragging(false);
      reset();
    };
    window.addEventListener("blur", cancel);
    return () => window.removeEventListener("blur", cancel);
  }, [dragging]);

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Enter" || event.key === " " || event.key === "ArrowDown") {
      event.preventDefault();
      event.stopPropagation();
      openSheet();
    }
  };

  const progress = Math.min(1, offset / STUB_TEAR_PX);

  return (
    <>
      <button
        type="button"
        aria-label={`Vi esto: registrar ${titleName} en tu diario`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onLostPointerCapture={handleLostPointerCapture}
        onKeyDown={handleKeyDown}
        onClick={(event) => event.stopPropagation()}
        data-no-sheet-drag=""
        className={cn(
          "ticket-stub",
          dragging && "is-dragging",
          progress >= 1 && "is-armed",
          torn && "is-torn",
          nudged && "is-nudged",
          breathing && "is-breathing",
          focusRing,
          className,
        )}
        style={{
          transform: `translate3d(-50%, ${offset}px, 0) rotate(${(offset / STUB_MAX_PX) * 3}deg)`,
          transition: dragging ? "none" : "transform var(--duration-hover) var(--ease-out)",
        }}
      >
        <span className="ticket-stub-notch is-left" aria-hidden="true" />
        <span className="ticket-stub-notch is-right" aria-hidden="true" />
        <span className="ticket-stub-glow" aria-hidden="true" />
        <EyeIcon />
        <span>Vi esto</span>
      </button>
      {dragging && offset >= STUB_TAP_SLOP_PX ? (
        <span className="ticket-stub-hint" aria-hidden="true">
          {progress >= 1 ? "Suelta para «Vi esto»" : "Arranca el talón"}
        </span>
      ) : nudged ? (
        <span className="ticket-stub-hint is-nudge" aria-hidden="true">
          Arranca hasta el fondo
        </span>
      ) : null}
      <MarkWatchedSheet
        open={open}
        titleId={titleId}
        titleName={titleName}
        rating={rating}
        review={review}
        platform={platform ?? undefined}
        saveLabel={PICKS_SAVE_LABEL}
        silent
        onClose={() => {
          setOpen(false);
          reset();
        }}
        onSaved={() => {
          setOpen(false);
          if (!saveSeen) {
            onSaved?.();
          }
        }}
        onError={(message) => {
          reset();
          onError?.(message);
        }}
        submit={
          saveSeen
            ? async (formData) => {
                const error = await saveSeen(formData);
                if (error) {
                  throw new Error(error);
                }
                onSaved?.();
              }
            : undefined
        }
      />
    </>
  );
};

const EyeIcon = () => (
  <svg
    viewBox="0 0 24 24"
    width="14"
    height="14"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M2.8 12s3.4-6.4 9.2-6.4S21.2 12 21.2 12s-3.4 6.4-9.2 6.4S2.8 12 2.8 12Z"
    />
    <circle cx="12" cy="12" r="2.6" />
  </svg>
);
