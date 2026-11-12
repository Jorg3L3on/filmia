"use client";

import { useEffect, useRef, useState } from "react";
import { LaunchMark } from "@/components/launch/LaunchMark";

/** How long the loader waits for Hoy's deck before revealing whatever is there. */
const READY_CAP_MS = 3000;
/** Extra wait for the hero poster image once the deck is in the DOM. */
const POSTER_IMAGE_CAP_MS = 600;
/** Hoy's real deck stage (the skeleton reuses the stage class, not the deck root). */
const STAGE = ".hoy-act-one .diario-que-ver-deck .coverflow-cinematic-stage";
/** The Hoy reveal (stage 1.1s, last rise 370ms + 560ms) after the exit starts. */
const HOY_REVEAL_MS = 1200;
/** If no animationend arrives (tab hidden, styles missing), finish anyway. */
const EXIT_FALLBACK_MS = 1400;

type Reveal = "hoy" | "plain";

const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

/**
 * Where Hoy stands right now: still loading, showing its deck, or showing
 * something else (an empty state, the closing card).
 */
const hoyState = (): "wait" | Reveal => {
  const main = document.getElementById("contenido");
  if (!main || main.querySelector('[aria-busy="true"]')) {
    return "wait";
  }
  const act = main.querySelector(".hoy-act-one");
  if (!act) {
    return main.childElementCount > 0 ? "plain" : "wait";
  }
  if (act.querySelector(".diario-que-ver-deck .coverflow-cinematic-stage")) {
    return "hoy";
  }
  // TonightSala paints HoyDeckSkeleton until its clock is set on the client.
  return act.querySelector('.diario-que-ver-body[aria-hidden="true"]') ? "wait" : "plain";
};

const heroImagesReady = (stage: Element) =>
  Array.from(stage.querySelectorAll("img")).every((img) => img.complete);

/**
 * Cold-start loader (FIL-43). Server-rendered in the root layout, outside
 * every Suspense boundary, so streaming never swaps it out before hydration.
 * It leaves once the app is hydrated and (on `/`) Hoy has painted its deck,
 * and only unmounts after its exit animation ends. Client navigations never
 * see it again: the layout stays mounted.
 */
export const LaunchLoader = () => {
  const ref = useRef<HTMLDivElement>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const loader = ref.current;
    if (!loader || !isStandalone()) {
      setDone(true);
      return;
    }

    const root = document.documentElement;
    const started = performance.now();
    const timers: number[] = [];
    let frame = 0;
    let exiting = false;

    const finish = () => setDone(true);

    const onAnimationEnd = (event: AnimationEvent) => {
      if (event.animationName === "launch-glow-out" || event.animationName === "launch-fade") {
        if (event.target === loader || (event.target as Element).classList.contains("launch-glow")) {
          finish();
        }
      }
    };

    const exit = (reveal: Reveal) => {
      // Also guards React's dev double effect: the loader leaves once.
      if (exiting || loader.dataset.state === "out") {
        return;
      }
      exiting = true;
      cancelAnimationFrame(frame);

      if (reveal === "hoy") {
        const stage = document.querySelector<HTMLElement>(STAGE);
        if (stage) {
          // The stage grows out of the F's center: 50% across, 43% down the viewport.
          const rect = stage.getBoundingClientRect();
          stage.style.setProperty("--launch-ox", `${window.innerWidth / 2 - rect.left}px`);
          stage.style.setProperty("--launch-oy", `${window.innerHeight * 0.43 - rect.top}px`);
          timers.push(
            window.setTimeout(() => {
              stage.style.removeProperty("--launch-ox");
              stage.style.removeProperty("--launch-oy");
            }, HOY_REVEAL_MS),
          );
        }
        root.dataset.launch = "hoy";
        timers.push(
          window.setTimeout(() => {
            delete root.dataset.launch;
          }, HOY_REVEAL_MS),
        );
      }

      // Same task as data-launch: Hoy's first animated frame is the loader's first exit frame.
      loader.addEventListener("animationend", onAnimationEnd);
      loader.dataset.state = "out";
      timers.push(window.setTimeout(finish, EXIT_FALLBACK_MS));
    };

    let imagesSince = 0;
    const poll = () => {
      const elapsed = performance.now() - started;
      if (window.location.pathname !== "/") {
        exit("plain");
        return;
      }
      const state = hoyState();
      if (state === "hoy") {
        const stage = document.querySelector(STAGE);
        imagesSince ||= performance.now();
        if (stage && !heroImagesReady(stage) && performance.now() - imagesSince < POSTER_IMAGE_CAP_MS) {
          frame = requestAnimationFrame(poll);
          return;
        }
        exit("hoy");
        return;
      }
      if (state === "plain") {
        exit("plain");
        return;
      }
      if (elapsed >= READY_CAP_MS) {
        exit("plain");
        return;
      }
      frame = requestAnimationFrame(poll);
    };

    poll();
    // rAF stops in a hidden page; the cap still runs.
    timers.push(
      window.setTimeout(() => exit(hoyState() === "hoy" ? "hoy" : "plain"), READY_CAP_MS),
    );

    return () => {
      cancelAnimationFrame(frame);
      for (const timer of timers) {
        window.clearTimeout(timer);
      }
      loader.removeEventListener("animationend", onAnimationEnd);
    };
  }, []);

  if (done) {
    return null;
  }

  return (
    <div ref={ref} className="launch-loader" role="status" aria-label="Filmia">
      <LaunchMark />
    </div>
  );
};
