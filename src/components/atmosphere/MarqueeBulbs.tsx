"use client";

import { useRef, type CSSProperties } from "react";
import { cn } from "@/lib/cn";
import { useAmbientPause, useAtmosphereOn } from "@/lib/motion-atmosphere";

/**
 * A row of marquee bulbs that light in sequence (FIL-I46-3, also Cine in FIL-I46-4). Opacity only,
 * paused off screen, never under reduced motion or lite sala.
 */
export const MarqueeBulbs = ({ count = 14, className }: { count?: number; className?: string }) => {
  const on = useAtmosphereOn();
  const ref = useRef<HTMLDivElement>(null);
  useAmbientPause(ref, on);
  if (!on) {
    return null;
  }
  return (
    <div ref={ref} aria-hidden data-marquee-bulbs className={cn("marquee-bulbs", className)}>
      {Array.from({ length: count }, (_, index) => (
        <i key={index} style={{ "--bulb": index } as CSSProperties} />
      ))}
    </div>
  );
};
