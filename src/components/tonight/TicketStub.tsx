"use client";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { MarkWatchedSheet } from "@/components/MarkWatchedSheet";
import { cn } from "@/lib/cn";
import { PICKS_SAVE_LABEL } from "@/lib/mark-seen";
import { focusRing } from "@/lib/ui";

/** Drag past this many px and the perforation tears. */
export const STUB_TEAR_PX = 60;
const STUB_MAX_PX = 96;

type TicketStubProps = {
  titleId: string;
  titleName: string;
  rating?: number | null;
  review?: string | null;
  /** Fires once when the tear commits (light-leak hook). */
  onCommit?: () => void;
  onSaved?: () => void;
  onError?: (message: string) => void;
  /**
   * Log it seen right away instead of opening «Marqué visto» (a recommendation has no title to
   * rate yet). Resolves to an error message, or null when it saved.
   */
  commitDirectly?: () => Promise<string | null>;
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
  onCommit,
  onSaved,
  onError,
  commitDirectly,
  className,
}: TicketStubProps) => {
  const [open, setOpen] = useState(false);
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [torn, setTorn] = useState(false);
  const startY = useRef(0);
  const moved = useRef(false);
  const armed = useRef(false);
  // A tap fires pointerdown → pointerup before React commits `dragging`; track it in a ref.
  const active = useRef(false);

  useEffect(() => {
    if (!open) {
      armed.current = false;
    }
  }, [open]);

  const openSheet = () => {
    onCommit?.();
    setTorn(true);
    if (commitDirectly) {
      void commitDirectly().then((error) => {
        if (error) {
          reset();
          onError?.(error);
          return;
        }
        onSaved?.();
      });
      return;
    }
    setOpen(true);
  };

  const reset = () => {
    setOffset(0);
    setTorn(false);
    armed.current = false;
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || open) {
      return;
    }
    // Keep the deck from starting a horizontal drag.
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    startY.current = event.clientY;
    moved.current = false;
    armed.current = false;
    active.current = true;
    setDragging(true);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!active.current) {
      return;
    }
    event.stopPropagation();
    if (prefersReducedMotion()) {
      return;
    }
    const dy = Math.min(STUB_MAX_PX, Math.max(0, event.clientY - startY.current));
    if (dy > 4) {
      moved.current = true;
    }
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
    active.current = false;
    event.stopPropagation();
    setDragging(false);
    if (!moved.current || armed.current) {
      haptic(armed.current ? 20 : 0);
      setOffset(armed.current ? STUB_TEAR_PX + 18 : 0);
      openSheet();
      return;
    }
    reset();
  };

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
        onPointerCancel={handlePointerUp}
        onKeyDown={handleKeyDown}
        onClick={(event) => event.stopPropagation()}
        data-no-sheet-drag=""
        className={cn(
          "ticket-stub",
          dragging && "is-dragging",
          progress >= 1 && "is-armed",
          torn && "is-torn",
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
        <EyeIcon />
        <span>Vi esto</span>
      </button>
      {dragging && offset > 8 ? (
        <span className="ticket-stub-hint" aria-hidden="true">
          {progress >= 1 ? "Suelta para «Vi esto»" : "Arranca el talón"}
        </span>
      ) : null}
      <MarkWatchedSheet
        open={open}
        titleId={titleId}
        titleName={titleName}
        rating={rating}
        review={review}
        saveLabel={PICKS_SAVE_LABEL}
        silent
        onClose={() => {
          setOpen(false);
          reset();
        }}
        onSaved={() => {
          setOpen(false);
          onSaved?.();
        }}
        onError={(message) => {
          reset();
          onError?.(message);
        }}
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
