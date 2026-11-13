import { seededRandom, seededShuffle } from "@/lib/juegos/seed";

/**
 * Duelo de gustos (FIL-I53-6): seven pairs of films the other person rated; guess which one they
 * liked more. Pure: which pairs. Only the person's own ratings (`Title.rating`, 1–10), never the
 * `impliedRating` of ¿Las viste?, and never two films closer than two points.
 */

export const GUSTOS_ID = "gustos";
export const GUSTOS_PAIRS = 7;
/** Rated films each person needs: seven pairs, no film twice. */
export const GUSTOS_MIN_RATED = GUSTOS_PAIRS * 2;
export const GUSTOS_MIN_GAP = 2;

export type GustosRated = { catalogId: string; rating: number };
/** A stored pair: the films and the target person's ratings (server only). */
export type GustosPair = { a: string; b: string; ra: number; rb: number };

const isRating = (value: number) => Number.isInteger(value) && value >= 1 && value <= 10;

/**
 * Seven pairs from a person's own ratings, seeded: every film at most once, every pair at least
 * two points apart. Null when there are not enough rated films or not enough spread.
 *
 * Sorted by rating (ties in a seeded order), the lower half is matched against the upper half with
 * two pointers: that finds as many pairs as the ratings allow (a greedy pass in random order can
 * miss a valid set). The seed then picks which seven and which film goes left.
 */
export const buildGustosPairs = (rated: readonly GustosRated[], seed: string, count = GUSTOS_PAIRS): GustosPair[] | null => {
  const unique = new Map<string, number>();
  for (const row of rated) if (isRating(row.rating) && !unique.has(row.catalogId)) unique.set(row.catalogId, row.rating);
  if (unique.size < count * 2) return null;
  const films = seededShuffle(
    [...unique.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([catalogId, rating]) => ({ catalogId, rating })),
    seed,
  ).sort((a, b) => a.rating - b.rating);
  const half = Math.floor(films.length / 2);
  const matched: Array<[GustosRated, GustosRated]> = [];
  for (let low = 0, high = half; low < half && high < films.length; high += 1) {
    if (films[high]!.rating - films[low]!.rating >= GUSTOS_MIN_GAP) {
      matched.push([films[low]!, films[high]!]);
      low += 1;
    }
  }
  if (matched.length < count) return null;
  const random = seededRandom(`${seed}|lados`);
  return seededShuffle(matched, `${seed}|pares`)
    .slice(0, count)
    .map(([lower, higher]) => {
      const [left, right] = random() < 0.5 ? [lower, higher] : [higher, lower];
      return { a: left.catalogId, b: right.catalogId, ra: left.rating, rb: right.rating };
    });
};

/** The right pick of a pair: the film the target person rated higher. */
export const gustosWinner = (pair: GustosPair) => (pair.ra > pair.rb ? pair.a : pair.b);

/** What blocks a duel, in words: «Te faltan 4 películas calificadas.» */
export const gustosMissingLine = (rated: number, who: "tú" | string) => {
  const missing = Math.max(0, GUSTOS_MIN_RATED - rated);
  if (missing === 0) return null;
  const films = missing === 1 ? "película calificada" : "películas calificadas";
  return who === "tú" ? `Te faltan ${missing} ${films} (con tu propia nota).` : `A ${who} le faltan ${missing} ${films}.`;
};
