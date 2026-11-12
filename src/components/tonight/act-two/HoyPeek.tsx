"use client";

import { useEffect, useRef, useState } from "react";
import { recordActTwoEvent } from "@/app/actions/tonight";
import { cn } from "@/lib/cn";
import { usePrefersReducedMotion } from "@/lib/motion";
import { useAtmosphereLite } from "@/lib/motion-atmosphere";
import {
  ASOMO_DELAY_MS,
  ASOMO_KEY,
  asomoDistance,
  fitPeek,
  parseAsomo,
  shouldBounce,
  type AsomoState,
  type PeekFit,
} from "@/lib/service-charts";
import { focusRing } from "@/lib/ui";

const ACT_TWO_ID = "en-tus-plataformas";

const readAsomo = (): AsomoState | null => {
  try {
    return parseAsomo(window.localStorage.getItem(ASOMO_KEY));
  } catch {
    // Private mode: no memory, so no bounce (it would repeat on every visit).
    return null;
  }
};

const writeAsomo = (state: AsomoState) => {
  try {
    window.localStorage.setItem(ASOMO_KEY, JSON.stringify(state));
  } catch {
    // Nothing to keep.
  }
};

/** Scrolls to `to` over `ms` with an ease-out, frame by frame (iOS Safari ignored a smooth scrollTo here). */
const glide = (to: number, ms: number, done: () => void) => {
  const from = window.scrollY;
  const start = performance.now();
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / ms);
    const eased = 1 - (1 - t) ** 3;
    window.scrollTo(0, from + (to - from) * eased);
    if (t < 1) window.requestAnimationFrame(step);
    else done();
  };
  window.requestAnimationFrame(step);
};

/** One dip of the page and back (FIL-I47-6): the act two's top shows over the dock. */
const bounce = (done: () => void) => {
  const dock = document.querySelector<HTMLElement>('nav[aria-label="Principal móvil"] [data-dock-shell]');
  const dockRect = dock?.getBoundingClientRect();
  const dockTop = dockRect && dockRect.height > 0 ? dockRect.top : window.innerHeight;
  glide(asomoDistance(window.innerHeight, dockTop), 520, () => {
    window.setTimeout(() => glide(0, 620, done), 650);
  });
};

/** The dock's top, or the viewport's bottom where there is no dock (desktop). */
const dockTopNow = () => {
  const dock = document.querySelector<HTMLElement>('nav[aria-label="Principal móvil"] [data-dock-shell]');
  const rect = dock?.getBoundingClientRect();
  return rect && rect.height > 0 ? rect.top : window.innerHeight;
};

/** The sala's lowest content and the dock's top. */
const measure = (): PeekFit => {
  const sala = document.querySelector(".tonight-sala .tonight-footer") ?? document.querySelector(".tonight-sala");
  if (!sala) return { mode: "none", top: 0 };
  return fitPeek(sala.getBoundingClientRect().bottom, dockTopNow());
};

/**
 * Where the act stands against the dock (not the viewport: iOS Safari lays the page out under its
 * floating toolbar, so an act «in the viewport» can still be hidden behind the bars).
 */
const actPosition = (target: HTMLElement) => {
  const top = target.getBoundingClientRect().top;
  const dockTop = dockTopNow();
  return { hidden: top >= dockTop - 2, reached: top < dockTop - 40 };
};

/**
 * The one new line on Hoy's first screen (FIL-I47-1): «En tus plataformas hoy», centred between the
 * sala and the dock while the second act is still below the fold. A tap scrolls to it. Where the
 * gap is too tight for the words (iOS Safari leaves ~12 px), only the chevron shows.
 */
export const HoyPeek = () => {
  const reducedMotion = usePrefersReducedMotion();
  const lite = useAtmosphereLite();
  const [below, setBelow] = useState(false);
  const [fit, setFit] = useState<PeekFit>({ mode: "none", top: 0 });
  /** «acto_dos_visto» once per page: the act reached the viewport (FIL-I47-4 metric). */
  const seenRef = useRef(false);
  /** The asomo's own scroll is under way: it is not the person reaching the act. */
  const bouncingRef = useRef(false);

  useEffect(() => {
    const target = document.getElementById(ACT_TWO_ID);
    if (!target || typeof IntersectionObserver === "undefined") {
      return;
    }
    let frame = 0;
    let wasHidden: boolean | null = null;
    const update = () => {
      frame = 0;
      const { hidden, reached } = actPosition(target);
      if (hidden !== wasHidden) {
        wasHidden = hidden;
        // Shown only while the act is still behind the dock (not after scrolling past it).
        setBelow(hidden);
      }
      // The fit is the first screen's: measured at the top of the page, never mid-scroll or mid-bounce.
      if (hidden && window.scrollY < 2 && !bouncingRef.current) setFit(measure());
      // Reached by the person's own scroll, never by the asomo or by how a browser lays out the fold.
      if (reached && window.scrollY > 24 && !seenRef.current && !bouncingRef.current) {
        seenRef.current = true;
        void recordActTwoEvent("acto_dos_visto");
        const stored = readAsomo();
        if (stored && !stored.seen) writeAsomo({ ...stored, seen: true });
      }
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    // Act two over most of the screen: the sala's floating bedtime chip steps aside (CSS on the flag).
    const covering = new IntersectionObserver(
      ([entry]) => {
        const over = Boolean(entry) && (entry.isIntersecting || entry.boundingClientRect.top < 0);
        if (over) document.documentElement.dataset.actoDos = "";
        else delete document.documentElement.dataset.actoDos;
      },
      { threshold: 0, rootMargin: "0px 0px -55% 0px" },
    );
    covering.observe(target);
    const remeasure = () => {
      setFit(measure());
      schedule();
    };
    window.addEventListener("resize", remeasure);
    // The deck's footer settles after the first paint (fonts, chips): measure once more.
    const settle = window.setTimeout(remeasure, 600);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      covering.disconnect();
      delete document.documentElement.dataset.actoDos;
      window.removeEventListener("resize", remeasure);
      window.clearTimeout(settle);
    };
  }, []);

  // FIL-I47-6 · asomo: where the line has no room, the first visits get one bounce instead.
  useEffect(() => {
    if (reducedMotion || lite) return;
    let touched = false;
    const touch = () => {
      if (!bouncingRef.current) touched = true;
    };
    const events = ["pointerdown", "wheel", "keydown", "touchstart", "scroll"] as const;
    for (const name of events) window.addEventListener(name, touch, { passive: true });
    const timer = window.setTimeout(() => {
      const state = readAsomo();
      const target = document.getElementById(ACT_TWO_ID);
      const actBelowFold = Boolean(target) && window.scrollY < 4 && actPosition(target!).hidden;
      const roomForLine = measure().mode === "full";
      if (!state || roomForLine || !shouldBounce({ state, reducedMotion, lite, actBelowFold, touched })) return;
      writeAsomo({ ...state, bounces: state.bounces + 1 });
      bouncingRef.current = true;
      bounce(() => {
        bouncingRef.current = false;
        if (window.scrollY < 2) setFit(measure());
      });
    }, ASOMO_DELAY_MS);
    return () => {
      window.clearTimeout(timer);
      for (const name of events) window.removeEventListener(name, touch);
    };
  }, [reducedMotion, lite]);

  const visible = below && fit.mode !== "none";

  return (
    <button
      type="button"
      className={cn("hoy-peek", visible && "is-visible", fit.mode === "chevron" && "is-chevron", focusRing)}
      style={{ top: fit.top }}
      aria-hidden={!visible}
      aria-label="En tus plataformas hoy: bajar"
      tabIndex={visible ? 0 : -1}
      onClick={() =>
        document.getElementById(ACT_TWO_ID)?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" })
      }
    >
      {fit.mode === "full" ? <span>En tus plataformas hoy</span> : null}
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <path d="M6 9l6 6 6-6" />
      </svg>
    </button>
  );
};
