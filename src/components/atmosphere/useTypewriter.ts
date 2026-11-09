"use client";

import { useEffect, useState } from "react";
import { cssTimeMs } from "@/lib/poster-flight";

/** Examples Buscar types into its empty field (FIL-I46-4). */
export const SEARCH_EXAMPLES = ["Dune", "Bong Joon-ho", "Pedro Páramo", "series de terror", "Greta Gerwig", "Interstellar"] as const;

/** One step of the typewriter: how much of which example shows at tick `n`. Pure, for tests. */
export const typewriterFrame = (examples: readonly string[], tick: number, hold = 14) => {
  let rest = Math.max(0, Math.floor(tick));
  for (let round = 0; ; round += 1) {
    const word = examples[round % examples.length] ?? "";
    const cycle = word.length * 2 + hold;
    if (rest < cycle) {
      const shown = rest < word.length ? rest + 1 : rest < word.length + hold ? word.length : cycle - rest - 1;
      return word.slice(0, Math.max(0, shown));
    }
    rest -= cycle;
  }
};

/**
 * Types the examples letter by letter while `active` (empty field, no focus, full motion), on the
 * press clock. Inactive, it returns null: the normal placeholder shows.
 */
export const useTypewriter = (active: boolean, examples: readonly string[] = SEARCH_EXAMPLES) => {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!active) return;
    const step = 0.5 * cssTimeMs(getComputedStyle(document.documentElement).getPropertyValue("--duration-press")) || 80;
    const timer = window.setInterval(() => setTick((value) => value + 1), step);
    return () => window.clearInterval(timer);
  }, [active]);
  return active ? typewriterFrame(examples, tick) : null;
};
