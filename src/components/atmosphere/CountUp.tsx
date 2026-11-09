"use client";

import { useEffect, useState } from "react";
import { cssTimeMs } from "@/lib/poster-flight";

/**
 * A number that counts up once when it mounts (FIL-I46-4/5). The server renders the final value;
 * reduced motion keeps it. Screen readers get the final value only.
 */
export const CountUp = ({ value, className }: { value: number; className?: string }) => {
  const [shown, setShown] = useState(value);
  useEffect(() => {
    if (value <= 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    const root = getComputedStyle(document.documentElement);
    const duration = 2 * cssTimeMs(root.getPropertyValue("--duration-cut"));
    const start = performance.now();
    let frame = window.requestAnimationFrame(function tick(now) {
      const t = Math.min(1, (now - start) / Math.max(1, duration));
      const eased = 1 - (1 - t) ** 3;
      setShown(Math.round(eased * value));
      if (t < 1) frame = window.requestAnimationFrame(tick);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [value]);
  return (
    <span className={className}>
      <span className="sr-only">{value}</span>
      <span aria-hidden="true" className="tabular-nums">
        {shown}
      </span>
    </span>
  );
};
