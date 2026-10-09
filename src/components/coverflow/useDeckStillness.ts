"use client";

import { useEffect, useState, type RefObject } from "react";

/** One full atmosphere breath is ~7 s; let it play after a touch, then hold. */
export const DECK_STILL_AFTER_MS = 12_000;

const WAKE_EVENTS = ["pointerdown", "keydown", "wheel"] as const;

/**
 * True once the cinematic deck has gone a while without interaction. The sala's
 * infinite breathing runs on blurred, blended, full-viewport layers, so every
 * frame is a full re-composite: a phone left on Hoy heats up. When still, the
 * CSS pauses those animations in place; any touch, key or hero change resumes.
 */
export const useDeckStillness = (
  rootRef: RefObject<HTMLElement | null>,
  /** Changes when the hero changes (chips, keyboard, «Vi esto»), which also wakes the deck. */
  wakeKey: string | number | null,
  enabled: boolean,
) => {
  const [still, setStill] = useState(false);

  useEffect(() => {
    const root = rootRef.current;
    if (!enabled || !root) {
      return;
    }

    let timer: number | null = null;
    const wake = () => {
      setStill(false);
      if (timer != null) {
        window.clearTimeout(timer);
      }
      timer = window.setTimeout(() => setStill(true), DECK_STILL_AFTER_MS);
    };

    for (const event of WAKE_EVENTS) {
      root.addEventListener(event, wake, { passive: true });
    }
    wake();

    return () => {
      if (timer != null) {
        window.clearTimeout(timer);
      }
      for (const event of WAKE_EVENTS) {
        root.removeEventListener(event, wake);
      }
    };
  }, [rootRef, enabled, wakeKey]);

  return enabled && still;
};
