"use client";

import { useEffect } from "react";

/**
 * Mirror the iOS keyboard height into `--keyboard-inset` on <html> while `enabled`.
 * Same math as Sheet.tsx; lets a sticky action bar ride above the keyboard.
 */
export const useKeyboardInset = (enabled: boolean) => {
  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      return;
    }
    const root = document.documentElement;
    const viewport = window.visualViewport;
    const sync = () => {
      if (!viewport) {
        return;
      }
      const inset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      root.style.setProperty("--keyboard-inset", `${Math.round(inset)}px`);
    };
    sync();
    viewport?.addEventListener("resize", sync);
    viewport?.addEventListener("scroll", sync);
    return () => {
      viewport?.removeEventListener("resize", sync);
      viewport?.removeEventListener("scroll", sync);
      root.style.removeProperty("--keyboard-inset");
    };
  }, [enabled]);
};
