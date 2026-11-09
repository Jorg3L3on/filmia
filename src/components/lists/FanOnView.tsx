"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Listas «Abanico» (FIL-I46-3): sets `data-fan` once the card is mostly in view, and again on a
 * tap, so its posters fan out and the live cover runs — once per entry, never in a loop.
 */
export const FanOnView = ({ children, className }: { children: ReactNode; className?: string }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          node.dataset.fan = "";
          observer.disconnect();
        }
      },
      { threshold: 0.6 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const replay = () => {
    const node = ref.current;
    if (!node) return;
    delete node.dataset.fan;
    // Next frame: the browser sees the attribute come back and plays the fan once more.
    window.requestAnimationFrame(() => {
      node.dataset.fan = "";
    });
  };

  return (
    <div ref={ref} className={className} data-fan-card onPointerDown={replay}>
      {children}
    </div>
  );
};
