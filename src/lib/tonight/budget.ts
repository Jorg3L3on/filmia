/**
 * «Tengo: 90 min / 2 h / 3 h / Sin límite» on Hoy (FIL-I31-1): a time budget narrows the deck to
 * three options. Pure, so the sala and `filterRecommendations` (MCP) share the same rule.
 */

export type TimeBudget = { id: string; label: string; maxRuntimeMin: number | null };

export const TIME_BUDGETS: readonly TimeBudget[] = [
  { id: "90", label: "90 min", maxRuntimeMin: 90 },
  { id: "120", label: "2 h", maxRuntimeMin: 120 },
  { id: "180", label: "3 h", maxRuntimeMin: 180 },
  { id: "all", label: "Sin límite", maxRuntimeMin: null },
];

export const NO_LIMIT_ID = "all";

/** How many cards the narrowed view shows. */
export const OPTIONS_COUNT = 3;

/** A card fits when its runtime is known and within the limit; no limit fits everything. */
export const fitsRuntime = (runtimeMinutes: number | null | undefined, maxRuntimeMin: number | null | undefined) =>
  maxRuntimeMin == null || (runtimeMinutes != null && runtimeMinutes <= maxRuntimeMin);

export type PickedOptions<T> = {
  cards: T[];
  /** Cards left out because their runtime is unknown (they might fit; the sala says how many). */
  unknownRuntime: number;
};

/**
 * The first `OPTIONS_COUNT` cards of the deck that fit the limit, in deck order (Para ti first,
 * nothing re-ranked). Without a limit the deck comes back unchanged.
 */
export const pickOptions = <T extends { id: string }>(
  deck: readonly T[],
  { maxRuntimeMin }: { maxRuntimeMin: number | null },
  runtimeOf: (card: T) => number | null | undefined,
): PickedOptions<T> => {
  if (maxRuntimeMin == null) {
    return { cards: [...deck], unknownRuntime: 0 };
  }
  const seen = new Set<string>();
  const cards: T[] = [];
  let unknownRuntime = 0;
  for (const card of deck) {
    if (seen.has(card.id)) continue;
    seen.add(card.id);
    const runtime = runtimeOf(card);
    if (runtime == null) {
      unknownRuntime += 1;
      continue;
    }
    if (cards.length < OPTIONS_COUNT && fitsRuntime(runtime, maxRuntimeMin)) cards.push(card);
  }
  return { cards, unknownRuntime };
};

/** The next wider budget, for «Sin resultados» (null once there is none). */
export const widerBudget = (id: string): TimeBudget | null => {
  const index = TIME_BUDGETS.findIndex((budget) => budget.id === id);
  return index >= 0 && index < TIME_BUDGETS.length - 1 ? TIME_BUDGETS[index + 1] : null;
};

/** `?tengo=90` on Hoy, kept by the shallow URL sync like `?lente=` and `?carta=`. */
export const TONIGHT_BUDGET_PARAM = "tengo";
