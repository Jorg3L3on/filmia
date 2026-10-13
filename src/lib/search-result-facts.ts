import type { TitleKind } from "@/db";

/**
 * What a Buscar row adds to TMDB's search snapshot (row A, FIL-I8-4): read
 * from the shared Catalog, so a film anybody saved shows its IMDb at once.
 * `pending` = the Catalog is filling it right now (the row holds the space).
 */
export type SearchResultFacts = {
  imdbRating: number | null;
  awardLabel: string | null;
  runtimeMinutes: number | null;
  genre: string | null;
  platform: string | null;
  pending: boolean;
};

export const searchFactsKey = (kind: TitleKind, tmdbId: number) => `${kind}:${tmdbId}`;
