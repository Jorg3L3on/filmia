"use client";

import { useEffect, useRef, useState } from "react";
import { recordActTwoEvent } from "@/app/actions/tonight";
import { cn } from "@/lib/cn";
import { usePrefersReducedMotion } from "@/lib/motion";
import { fitPeek, type PeekFit } from "@/lib/service-charts";
import { focusRing } from "@/lib/ui";

const ACT_TWO_ID = "en-tus-plataformas";

/** The sala's lowest content and the dock's top (or the viewport's bottom on desktop). */
const measure = (): PeekFit => {
  const sala = document.querySelector(".tonight-sala .tonight-footer") ?? document.querySelector(".tonight-sala");
  if (!sala) return { mode: "none", top: 0 };
  const dock = document.querySelector<HTMLElement>('nav[aria-label="Principal móvil"] [data-dock-shell]');
  const dockRect = dock?.getBoundingClientRect();
  const dockTop = dockRect && dockRect.height > 0 ? dockRect.top : window.innerHeight;
  return fitPeek(sala.getBoundingClientRect().bottom, dockTop);
};

/**
 * The one new line on Hoy's first screen (FIL-I47-1): «En tus plataformas hoy», centred between the
 * sala and the dock while the second act is still below the fold. A tap scrolls to it. Where the
 * gap is too tight for the words (iOS Safari leaves ~12 px), only the chevron shows.
 */
export const HoyPeek = () => {
  const reducedMotion = usePrefersReducedMotion();
  const [below, setBelow] = useState(false);
  const [fit, setFit] = useState<PeekFit>({ mode: "none", top: 0 });
  /** «acto_dos_visto» once per page: the act reached the viewport (FIL-I47-4 metric). */
  const seenRef = useRef(false);

  useEffect(() => {
    const target = document.getElementById(ACT_TWO_ID);
    if (!target || typeof IntersectionObserver === "undefined") {
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        // Shown only while the act starts below the viewport (not after scrolling past it).
        const waiting = Boolean(entry) && !entry.isIntersecting && entry.boundingClientRect.top > 0;
        setBelow(waiting);
        if (waiting) setFit(measure());
        if (entry?.isIntersecting && !seenRef.current) {
          seenRef.current = true;
          void recordActTwoEvent("acto_dos_visto");
        }
      },
      // Touching the fold counts as intersecting: the act starts exactly there on a phone.
      { threshold: 0, rootMargin: "0px 0px -12px 0px" },
    );
    observer.observe(target);
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
    const remeasure = () => setFit(measure());
    window.addEventListener("resize", remeasure);
    // The deck's footer settles after the first paint (fonts, chips): measure once more.
    const settle = window.setTimeout(remeasure, 600);
    return () => {
      observer.disconnect();
      covering.disconnect();
      delete document.documentElement.dataset.actoDos;
      window.removeEventListener("resize", remeasure);
      window.clearTimeout(settle);
    };
  }, []);

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
