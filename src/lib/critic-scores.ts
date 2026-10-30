/**
 * Rotten Tomatoes and Metacritic from the same OMDb response that brings the
 * IMDb rating (FIL-I36): no extra calls. Shapes seen in the wild:
 *   Ratings: [{ Source: "Rotten Tomatoes", Value: "96%" }, { Source: "Metacritic", Value: "72/100" }]
 *   Metascore: "72" | "N/A"
 */

export type OmdbRatingEntry = { Source?: string; Value?: string };

/** A 0–100 integer, or null for anything else. */
const percentScore = (value: number) =>
  Number.isInteger(value) && value >= 0 && value <= 100 ? value : null;

/** Tomatometer from OMDb `Ratings`: "96%" → 96; no entry or "N/A" → null. */
export const parseRottenTomatoes = (ratings: OmdbRatingEntry[] | null | undefined): number | null => {
  const entry = ratings?.find((rating) => rating.Source?.trim().toLowerCase() === "rotten tomatoes");
  const match = entry?.Value?.trim().match(/^(\d{1,3})%$/);
  return match ? percentScore(Number(match[1])) : null;
};

/** OMDb `Metascore`: "72" → 72; "N/A" or empty → null. */
export const parseMetascore = (value: string | null | undefined): number | null => {
  const trimmed = value?.trim() ?? "";
  return /^\d{1,3}$/.test(trimmed) ? percentScore(Number(trimmed)) : null;
};

/** Fresh tomato at 60 % and up, splat below (Rotten Tomatoes' own line). */
export const rtIsFresh = (score: number) => score >= 60;

export type MetacriticTier = "good" | "mixed" | "bad";

/** Metacritic's colour bands: 61+ green, 40–60 yellow, under 40 red. */
export const metacriticTier = (score: number): MetacriticTier =>
  score >= 61 ? "good" : score >= 40 ? "mixed" : "bad";

/** Search pages: the title's own pages need ids OMDb does not send. */
export const rottenTomatoesSearchUrl = (name: string) =>
  `https://www.rottentomatoes.com/search?search=${encodeURIComponent(name)}`;

export const metacriticSearchUrl = (name: string) =>
  `https://www.metacritic.com/search/${encodeURIComponent(name)}/`;
