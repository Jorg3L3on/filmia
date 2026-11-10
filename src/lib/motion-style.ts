import type { CSSProperties } from "react";

/** Inline vars for `.stagger-in`. No client directive — Server Components call it. */
export const staggerStyle = (index: number, stepMs = 50): CSSProperties =>
  ({
    "--stagger": index,
    "--stagger-step": `${stepMs}ms`,
  }) as CSSProperties;

/**
 * Inline var for `.cascade-in.cascade-item` (FIL-I46-1): item n enters at 220 + 50 n ms on
 * the cut curve; CSS caps n at 7, so a long list never waits.
 */
export const cascadeStyle = (index: number): CSSProperties =>
  ({ "--cascade-i": Math.max(0, Math.floor(index)) }) as CSSProperties;

/** How far the dock pill stretches for a jump of `distance` tabs (one tab 1.35×, capped at 1.9×). */
export const dockStretchScale = (distance: number) =>
  distance <= 0 ? 1 : Math.min(1.9, 1 + 0.35 * distance);
