import type { CSSProperties } from "react";

/** Inline vars for `.stagger-in`. No client directive — Server Components call it. */
export const staggerStyle = (index: number, stepMs = 50): CSSProperties =>
  ({
    "--stagger": index,
    "--stagger-step": `${stepMs}ms`,
  }) as CSSProperties;
