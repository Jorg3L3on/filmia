"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { MarkWatchedSheet } from "@/components/MarkWatchedSheet";
import { cn } from "@/lib/cn";
import { PICKS_SAVE_LABEL } from "@/lib/mark-seen";
import { focusRing } from "@/lib/ui";

const COMMIT_RATIO = 0.72;

type SlideToMarkSeenProps = {
  titleId: string;
  titleName: string;
  rating?: number | null;
  review?: string | null;
  saveLabel?: string;
  className?: string;
  onSaved?: () => void;
  onError?: (message: string) => void;
  /** Fires once when the slide commits (opens sheet) — light-leak hook. */
  onCommit?: () => void;
};

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export const SlideToMarkSeen = ({
  titleId,
  titleName,
  rating = null,
  review = null,
  saveLabel = PICKS_SAVE_LABEL,
  className,
  onSaved,
  onError,
  onCommit,
}: SlideToMarkSeenProps) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [maxTravel, setMaxTravel] = useState(0);
  const startX = useRef(0);
  const startOffset = useRef(0);
  const committed = useRef(false);

  useEffect(() => {
    const node = trackRef.current;
    if (!node) {
      return;
    }

    const measure = () => {
      const handle = 48;
      const pad = 6;
      setMaxTravel(Math.max(0, node.clientWidth - handle - pad * 2));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [titleId]);

  const openSheet = () => {
    if (committed.current) {
      return;
    }
    committed.current = true;
    setOffset(maxTravel);
    onCommit?.();
    setOpen(true);
  };

  const resetHandle = () => {
    committed.current = false;
    setOffset(0);
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || open || hidden) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    startX.current = event.clientX;
    startOffset.current = offset;
    setDragging(true);

    if (prefersReducedMotion()) {
      openSheet();
      setDragging(false);
    }
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!dragging || prefersReducedMotion()) {
      return;
    }

    event.stopPropagation();
    const delta = event.clientX - startX.current;
    const next = Math.min(maxTravel, Math.max(0, startOffset.current + delta));
    setOffset(next);
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!dragging) {
      return;
    }

    event.stopPropagation();
    setDragging(false);

    if (prefersReducedMotion()) {
      return;
    }

    if (maxTravel > 0 && offset / maxTravel >= COMMIT_RATIO) {
      openSheet();
      return;
    }

    resetHandle();
  };

  const handleSaved = () => {
    setHidden(true);
    setOpen(false);
    onSaved?.();
  };

  const handleError = (message: string) => {
    setHidden(false);
    resetHandle();
    onError?.(message);
  };

  const handleClose = () => {
    setOpen(false);
    resetHandle();
  };

  if (hidden) {
    return null;
  }

  const progress = maxTravel > 0 ? offset / maxTravel : 0;

  return (
    <>
      <div
        ref={trackRef}
        className={cn(
          "relative mx-auto flex h-14 w-full max-w-md items-center overflow-hidden rounded-full border border-chrome/80 bg-black/45 px-1.5 shadow-[inset_0_1px_0_rgb(255_255_255/0.06)] backdrop-blur-md",
          className,
        )}
        data-no-sheet-drag=""
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-1 left-1 rounded-full bg-accent/15"
          style={{ width: `calc(${Math.max(progress, 0.08) * 100}% - 0.15rem)` }}
        />
        <p
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-x-14 text-center text-sm font-medium text-fog transition-opacity duration-[var(--duration-hover)]",
            progress > 0.35 ? "opacity-0" : "opacity-100",
          )}
        >
          Desliza para <span className="text-accent">«Vi esto»</span>
        </p>
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute right-4 text-sm text-paper/70 transition-opacity duration-[var(--duration-hover)]",
            progress > 0.2 ? "opacity-0" : "opacity-100",
          )}
        >
          ≫
        </span>
        <button
          type="button"
          aria-label={`Desliza para marcar visto: ${titleName}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
          role="slider"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              openSheet();
            } else if (event.key === "ArrowRight") {
              event.preventDefault();
              openSheet();
            } else if (event.key === "Home" || event.key === "Escape") {
              event.preventDefault();
              resetHandle();
            }
          }}
          className={cn(
            "press-scale relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-ink shadow-[0_8px_20px_rgba(124,156,255,0.35)] touch-none",
            focusRing,
            dragging ? "cursor-grabbing" : "cursor-grab",
          )}
          style={{
            transform: `translate3d(${offset}px, 0, 0)`,
            transition: dragging
              ? "none"
              : "transform var(--duration-hover) var(--ease-out)",
          }}
        >
          <EyeIcon className="h-5 w-5" />
        </button>
      </div>
      <MarkWatchedSheet
        open={open}
        titleId={titleId}
        titleName={titleName}
        rating={rating}
        review={review}
        saveLabel={saveLabel}
        onClose={handleClose}
        onSaved={handleSaved}
        onError={handleError}
      />
    </>
  );
};

const EyeIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
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
