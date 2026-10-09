"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createFramePaceMonitor, isLowEndDevice } from "@/lib/deck-lite";

const LITE_SESSION_KEY = "filmia:deck-lite";
/** Hydration and first image decodes stutter on any phone: don't judge them. */
const WARMUP_MS = 2500;

const readSessionLite = () => {
  try {
    return window.sessionStorage.getItem(LITE_SESSION_KEY) === "1";
  } catch {
    return false;
  }
};

const rememberSessionLite = () => {
  try {
    window.sessionStorage.setItem(LITE_SESSION_KEY, "1");
  } catch {
    // Private mode: lite still holds for this page.
  }
};

/**
 * Lite sala (see `lib/deck-lite`): starts lite on clearly low-end hints or when this session
 * already tripped; otherwise the engine reports its motion frames and a sustained slow pace
 * switches it on. Marks `<html data-que-ver-lite>` so the full-bleed washes drop too.
 */
export const useDeckLite = (cinematic: boolean) => {
  const [lite, setLite] = useState(false);
  const liteRef = useRef(false);
  const monitorRef = useRef(createFramePaceMonitor());
  const judgeFromRef = useRef(Number.POSITIVE_INFINITY);

  useEffect(() => {
    if (!cinematic) {
      return;
    }
    judgeFromRef.current = performance.now() + WARMUP_MS;
    const hints = navigator as Navigator & { deviceMemory?: number };
    if (readSessionLite() || isLowEndDevice(hints)) {
      liteRef.current = true;
      // Client-only facts (session, device): known after hydration, never during render.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLite(true);
    }
  }, [cinematic]);

  useEffect(() => {
    if (!cinematic || !lite) {
      return;
    }
    const root = document.documentElement;
    root.dataset.queVerLite = "";
    return () => {
      delete root.dataset.queVerLite;
    };
  }, [cinematic, lite]);

  const reportFrame = useCallback(
    (frameMs: number) => {
      if (
        !cinematic ||
        liteRef.current ||
        document.visibilityState !== "visible" ||
        performance.now() < judgeFromRef.current
      ) {
        return;
      }
      if (monitorRef.current.push(frameMs)) {
        liteRef.current = true;
        rememberSessionLite();
        setLite(true);
      }
    },
    [cinematic],
  );

  return { lite: cinematic && lite, liteRef, reportFrame };
};
