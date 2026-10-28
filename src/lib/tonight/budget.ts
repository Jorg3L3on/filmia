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

export type Mood = { id: string; label: string; genres: readonly string[] };

/**
 * «Ánimo» (FIL-I31-2, set approved by Jorge 2026-10-28). Names as stored in `Catalog.tmdbGenres`
 * (TMDB es-MX): movie genres in Spanish plus TMDB's TV-only genres, which come back in English.
 */
export const MOODS: readonly Mood[] = [
  { id: "reir", label: "Reír", genres: ["Comedia", "Animación", "Familia", "Kids"] },
  {
    id: "tension",
    label: "Tensión",
    genres: ["Suspense", "Terror", "Crimen", "Misterio", "Acción", "Action & Adventure"],
  },
  { id: "emocionarme", label: "Emocionarme", genres: ["Drama", "Romance", "Música"] },
  { id: "ligera", label: "Ligera", genres: ["Comedia", "Aventura", "Animación", "Familia", "Romance", "Kids"] },
  {
    id: "pensar",
    label: "Pensar",
    genres: ["Documental", "Historia", "Ciencia ficción", "Bélica", "Sci-Fi & Fantasy", "War & Politics"],
  },
];

export const moodById = (id: string | null | undefined) => MOODS.find((mood) => mood.id === id) ?? null;

/** Accents and case do not count («Animacion» = «Animación»), like the single `genre` filter. */
export const foldGenre = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

/** Any-match: the card has at least one of `genres` (whole names, folded). No list matches all. */
export const matchesGenres = (
  cardGenres: readonly { name: string }[] | null | undefined,
  genres: readonly string[] | null | undefined,
) => {
  if (!genres?.length) return true;
  const wanted = new Set(genres.map(foldGenre));
  return (cardGenres ?? []).some((genre) => wanted.has(foldGenre(genre.name)));
};

export type PickedOptions<T> = {
  cards: T[];
  /** Cards left out because their runtime is unknown (they might fit; the sala says how many). */
  unknownRuntime: number;
};

/**
 * The first `OPTIONS_COUNT` cards of the deck that fit the time limit and the mood, in deck order
 * (Para ti first, nothing re-ranked). With neither the deck comes back unchanged.
 */
export const pickOptions = <T extends { id: string; genres?: readonly { name: string }[] | null }>(
  deck: readonly T[],
  { maxRuntimeMin, genres }: { maxRuntimeMin: number | null; genres?: readonly string[] | null },
  runtimeOf: (card: T) => number | null | undefined,
): PickedOptions<T> => {
  if (maxRuntimeMin == null && !genres?.length) {
    return { cards: [...deck], unknownRuntime: 0 };
  }
  const seen = new Set<string>();
  const cards: T[] = [];
  let unknownRuntime = 0;
  for (const card of deck) {
    if (seen.has(card.id)) continue;
    seen.add(card.id);
    if (!matchesGenres(card.genres, genres)) continue;
    const runtime = runtimeOf(card);
    if (maxRuntimeMin != null && runtime == null) {
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

/** `?animo=reir` on Hoy, next to `?tengo=`. */
export const TONIGHT_MOOD_PARAM = "animo";
