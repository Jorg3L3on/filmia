"use client";

/**
 * Motion helpers (Filmia UI v2). CSS lives in `globals.css` (Fase 2 language).
 * Sheets: `.sheet-rise` + `useSheetDragDismiss`. Never open a sheet with `.spring-pop`.
 * Shared-element: React `<ViewTransition name={poster-${id}} share="morph">`
 * on calendar/grid/deck/list/tag/search tiles and the ficha hero.
 */

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";

export {
  DIARY_MONTH_NAME,
  DIARY_STAGE_NAME,
  POSTER_TRANSITION_PREFIX,
  posterTransitionName,
} from "@/lib/motion-ids";

export const staggerStyle = (index: number, stepMs = 50): CSSProperties =>
  ({
    "--stagger": index,
    "--stagger-step": `${stepMs}ms`,
  }) as CSSProperties;

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";

const subscribeReducedMotion = (onStoreChange: () => void) => {
  const media = window.matchMedia(reducedMotionQuery);
  media.addEventListener("change", onStoreChange);
  return () => media.removeEventListener("change", onStoreChange);
};

const getReducedMotionSnapshot = () => window.matchMedia(reducedMotionQuery).matches;

export const usePrefersReducedMotion = () =>
  useSyncExternalStore(subscribeReducedMotion, getReducedMotionSnapshot, () => false);

export const useSpringFeedback = () => {
  const [active, setActive] = useState(false);
  const timer = useRef<number | null>(null);

  const trigger = () => {
    if (getReducedMotionSnapshot()) {
      return;
    }

    setActive(true);
    if (timer.current != null) {
      window.clearTimeout(timer.current);
    }
    timer.current = window.setTimeout(() => setActive(false), 420);
  };

  useEffect(
    () => () => {
      if (timer.current != null) {
        window.clearTimeout(timer.current);
      }
    },
    [],
  );

  return { active, trigger, className: active ? "spring-pop" : undefined };
};

export const useLongPress = (
  onLongPress: () => void,
  { delayMs = 420, moveThreshold = 8 } = {},
) => {
  const pointer = useRef<{ id: number; x: number; y: number; timer: number } | null>(
    null,
  );

  const clear = () => {
    if (!pointer.current) {
      return;
    }

    window.clearTimeout(pointer.current.timer);
    pointer.current = null;
  };

  const onPointerDown = (event: ReactPointerEvent) => {
    if (event.button !== 0) {
      return;
    }

    clear();
    const { pointerId, clientX, clientY } = event;
    pointer.current = {
      id: pointerId,
      x: clientX,
      y: clientY,
      timer: window.setTimeout(() => {
        pointer.current = null;
        onLongPress();
      }, delayMs),
    };
  };

  const onPointerMove = (event: ReactPointerEvent) => {
    if (!pointer.current || pointer.current.id !== event.pointerId) {
      return;
    }

    const dx = event.clientX - pointer.current.x;
    const dy = event.clientY - pointer.current.y;
    if (dx * dx + dy * dy > moveThreshold * moveThreshold) {
      clear();
    }
  };

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: clear,
    onPointerCancel: clear,
    onPointerLeave: clear,
  };
};

/** Vertical drag-to-dismiss for bottom sheets. Ignores `[data-no-sheet-drag]`. */
export const useSheetDragDismiss = (onClose: () => void, threshold = 96) => {
  const [offsetY, setOffsetY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startY = useRef<number | null>(null);
  const offsetRef = useRef(0);

  const handlePointerDown = (event: ReactPointerEvent) => {
    if (event.button !== 0) {
      return;
    }

    if ((event.target as HTMLElement).closest("[data-no-sheet-drag]")) {
      return;
    }

    startY.current = event.clientY;
    offsetRef.current = 0;
    setDragging(true);
  };

  const handlePointerMove = (event: ReactPointerEvent) => {
    if (startY.current == null) {
      return;
    }

    const dy = Math.max(0, event.clientY - startY.current);
    offsetRef.current = dy;
    setOffsetY(dy);
  };

  const handlePointerUp = () => {
    if (startY.current == null) {
      return;
    }

    const shouldClose = offsetRef.current >= threshold;
    startY.current = null;
    offsetRef.current = 0;
    setDragging(false);
    setOffsetY(0);
    if (shouldClose) {
      onClose();
    }
  };

  return {
    offsetY,
    dragging,
    sheetStyle:
      dragging || offsetY > 0
        ? ({
            transform: `translateY(${offsetY}px)`,
            transition: dragging
              ? "none"
              : "transform var(--duration-sheet) var(--ease-out)",
          } as CSSProperties)
        : undefined,
    dragHandlers: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerUp,
    },
  };
};
