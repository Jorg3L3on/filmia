"use client";

import { useEffect, useRef, useState } from "react";

/** Frames slower than this miss two 60 Hz refreshes: the ones a thumb notices. */
const LONG_FRAME_MS = 34;
const WINDOW_MS = 10_000;

/**
 * On-device frame meter, only behind `?fps=1` (FIL-I58): fps over the last second, how many frames
 * in the last 10 s took over 34 ms, and the worst one. Writes straight to the DOM so measuring
 * never re-renders React. Tap it to clear.
 */
const Meter = () => {
  const ref = useRef<HTMLButtonElement>(null);
  const clearRef = useRef<() => void>(() => {});

  useEffect(() => {
    let frame = 0;
    let last = 0;
    let frames: { at: number; ms: number }[] = [];
    const loop = (now: number) => {
      if (last) {
        frames.push({ at: now, ms: now - last });
      }
      last = now;
      frames = frames.filter((f) => now - f.at <= WINDOW_MS);
      const lastSecond = frames.filter((f) => now - f.at <= 1000).length;
      const long = frames.filter((f) => f.ms > LONG_FRAME_MS).length;
      const worst = frames.reduce((max, f) => Math.max(max, f.ms), 0);
      if (ref.current) {
        ref.current.textContent = `${lastSecond} fps · ${long} >34 ms · peor ${Math.round(worst)} ms`;
      }
      frame = requestAnimationFrame(loop);
    };
    clearRef.current = () => {
      frames = [];
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <button
      ref={ref}
      type="button"
      onClick={() => clearRef.current()}
      aria-label="Medidor de cuadros: toca para reiniciar"
      className="fixed left-2 top-[max(0.5rem,env(safe-area-inset-top))] z-[100] rounded-md bg-black/80 px-2 py-1 font-mono text-[11px] text-white"
    />
  );
};

const FLAG_KEY = "filmia-fps-meter";

/** `?fps=1` turns it on for the tab (Hoy rewrites the URL as cards pass); `?fps=0` turns it off. */
const readFlag = () => {
  const param = new URLSearchParams(window.location.search).get("fps");
  try {
    if (param === "1") {
      window.sessionStorage.setItem(FLAG_KEY, "1");
    } else if (param === "0") {
      window.sessionStorage.removeItem(FLAG_KEY);
    }
    return window.sessionStorage.getItem(FLAG_KEY) === "1";
  } catch {
    return param === "1";
  }
};

/** Renders nothing unless `?fps=1` was opened in this tab; read after mount so SSR and hydration agree. */
export const FrameMeter = () => {
  const [on, setOn] = useState(false);
  useEffect(() => {
    // Client-only fact: known after hydration, never during render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOn(readFlag());
  }, []);
  return on ? <Meter /> : null;
};
