"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { usePrefersReducedMotion } from "@/lib/motion";
import { focusRing } from "@/lib/ui";

const ACT_TWO_ID = "en-tus-plataformas";

/**
 * The one new line on Hoy's first screen (FIL-I47-1): «En tus plataformas hoy», just above the
 * dock, while the second act is still below the fold. A tap scrolls to it.
 */
export const HoyPeek = () => {
  const reducedMotion = usePrefersReducedMotion();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const target = document.getElementById(ACT_TWO_ID);
    if (!target || typeof IntersectionObserver === "undefined") {
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        // Shown only while the act starts below the viewport (not after scrolling past it).
        setVisible(Boolean(entry) && !entry.isIntersecting && entry.boundingClientRect.top > 0);
      },
      // Touching the fold counts as intersecting: the act starts exactly there on a phone.
      { threshold: 0, rootMargin: "0px 0px -12px 0px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  return (
    <button
      type="button"
      className={cn("hoy-peek", visible && "is-visible", focusRing)}
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
      onClick={() =>
        document.getElementById(ACT_TWO_ID)?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" })
      }
    >
      <span>En tus plataformas hoy</span>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <path d="M6 9l6 6 6-6" />
      </svg>
    </button>
  );
};
