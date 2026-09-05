"use client";

/**
 * Motion helpers (Filmia UI v2). CSS lives in `globals.css`.
 * Shared-element: React `<ViewTransition name={poster-${id}} share="morph">`
 * on calendar/grid/deck tiles and the ficha hero. Next 16 App Router treats
 * navigations as transitions — no next.config flag.
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
