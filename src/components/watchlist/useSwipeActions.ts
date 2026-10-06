"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { usePrefersReducedMotion } from "@/lib/motion";

/** Same thresholds as the Hoy ticket stub: arm at 60 px, stop at 96. */
export const SWIPE_ARM_PX = 60;
export const SWIPE_MAX_PX = 96;
/** Below this the gesture has no axis yet; vertical wins and the page scrolls natively. */
const AXIS_LOCK_PX = 8;

export type SwipeSide = "right" | "left";

type UseSwipeActionsOptions = {
  enabled?: boolean;
  onCommit: (side: SwipeSide) => void;
};

const haptic = (ms: number) => {
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    navigator.vibrate(ms);
  }
};

/**
 * Horizontal swipe on a ficha: right = «Vi esto», left = «Ahora no». Touch and
 * pen only (a mouse selects text). The axis locks after 8 px so vertical
 * scrolling never fights the gesture (`touch-action: pan-y` on the row).
 */
export const useSwipeActions = ({ enabled = true, onCommit }: UseSwipeActionsOptions) => {
  const [offset, setOffset] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const axis = useRef<"x" | "y" | null>(null);
  const armed = useRef<SwipeSide | null>(null);
  const moved = useRef(false);
  const reducedMotion = usePrefersReducedMotion();

  const reset = () => {
    start.current = null;
    axis.current = null;
    armed.current = null;
    setOffset(0);
    setSwiping(false);
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (!enabled || event.button !== 0 || event.pointerType === "mouse") {
      return;
    }
    moved.current = false;
    start.current = { x: event.clientX, y: event.clientY };
    axis.current = null;
    armed.current = null;
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    if (!start.current) {
      return;
    }
    const dx = event.clientX - start.current.x;
    const dy = event.clientY - start.current.y;

    if (!axis.current) {
      if (Math.hypot(dx, dy) < AXIS_LOCK_PX) {
        return;
      }
      axis.current = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      if (axis.current === "y") {
        start.current = null;
        return;
      }
      event.currentTarget.setPointerCapture(event.pointerId);
      moved.current = true;
      setSwiping(true);
    }

    const clamped = Math.max(-SWIPE_MAX_PX, Math.min(SWIPE_MAX_PX, dx));
    const side: SwipeSide | null =
      clamped >= SWIPE_ARM_PX ? "right" : clamped <= -SWIPE_ARM_PX ? "left" : null;
    if (side && side !== armed.current) {
      haptic(12);
    }
    armed.current = side;
    setOffset(reducedMotion ? 0 : clamped);
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLElement>) => {
    if (!start.current) {
      return;
    }
    const side = armed.current;
    const wasSwiping = axis.current === "x";
    reset();
    if (wasSwiping && event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (side) {
      haptic(20);
      onCommit(side);
    }
  };

  const armedSide: SwipeSide | null =
    offset >= SWIPE_ARM_PX ? "right" : offset <= -SWIPE_ARM_PX ? "left" : null;

  /** Another gesture (long-press) handled this pointer: swallow the click that follows. */
  const markHandled = () => {
    moved.current = true;
  };

  /** True once after a gesture, so `onClickCapture` can drop the synthetic click. */
  const consumeHandled = () => {
    const handled = moved.current;
    moved.current = false;
    return handled;
  };

  return {
    offset,
    swiping,
    armed: armedSide,
    markHandled,
    consumeHandled,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
    },
  };
};
