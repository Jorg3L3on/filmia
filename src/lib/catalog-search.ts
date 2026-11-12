import type { TitleKind } from "@/db/schema";
import { normalizeSearchQuery } from "@/lib/search-session";
import type { TmdbCatalogResult } from "@/lib/tmdb";

/**
 * How a stored film is matched (FIL-I48-2). The SQL form is
 * `catalogTitlesMatchSql` in `catalog-search-db.ts`: name, originalName, and
 * each stored alternate. A trailing year ("Ka 1990") picks the film of that
 * year; the digits are not required to sit inside the title.
 */

export type StoredTitleQuery = {
  name: string;
  originalName?: string | null;
  alternateNames?: readonly string[] | null;
  year?: number | null;
};

export type StoredCatalogHit = {
  id: string;
  tmdbId: number;
  kind: TitleKind;
  name: string;
  originalName: string | null;
  alternateNames: string[];
  year: number | null;
  posterPath: string | null;
  backdropPath: string | null;
  overview: string | null;
};

const TITLE_YEAR = /^(.*)\s+((?:19|20)\d{2})$/;

export const storedAlternateNames = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];

const titleFields = (film: StoredTitleQuery) =>
  [film.name, film.originalName, ...storedAlternateNames(film.alternateNames)].filter(
    (value): value is string => Boolean(value && value.trim()),
  );

/** "Ka 1990" → the words plus the year. A bare year stays in the text. */
export const splitCatalogSearch = (query: string) => {
  const trimmed = normalizeSearchQuery(query);
  const match = TITLE_YEAR.exec(trimmed);
  const text = match?.[1]?.trim() ?? "";
  if (!text || !match) {
    return { text: trimmed, year: null as number | null };
  }
  return { text, year: Number(match[2]) };
};

const includes = (value: string, needle: string) => value.toLowerCase().includes(needle.toLowerCase());

/**
 * True when this one stored film answers the query. Name, original title, and
 * alternates are the same film, so a hit is never emitted once per field.
 */
export const storedTitleMatches = (film: StoredTitleQuery, query: string) => {
  const trimmed = normalizeSearchQuery(query);
  if (!trimmed) {
    return false;
  }

  if (titleFields(film).some((value) => includes(value, trimmed))) {
    return true;
  }

  const { text, year } = splitCatalogSearch(trimmed);
  if (year != null && film.year === year && text && titleFields(film).some((value) => includes(value, text))) {
    return true;
  }

  return year == null && film.year != null && String(film.year).includes(trimmed);
};

/** Exact title before a prefix before a loose substring, for a short result list. */
export const storedTitleRank = (film: StoredTitleQuery, query: string) => {
  const { text } = splitCatalogSearch(query);
  const needle = text.toLowerCase();
  if (!needle) {
    return 2;
  }
  const fields = titleFields(film).map((value) => value.toLowerCase());
  if (fields.some((value) => value === needle)) {
    return 0;
  }
  if (fields.some((value) => value.startsWith(needle))) {
    return 1;
  }
  return 2;
};

export const toSearchResult = (hit: StoredCatalogHit): TmdbCatalogResult => ({
  tmdbId: hit.tmdbId,
  kind: hit.kind,
  name: hit.name,
  originalName: hit.originalName,
  year: hit.year,
  posterPath: hit.posterPath,
  backdropPath: hit.backdropPath,
  overview: hit.overview,
});

/**
 * Remote Buscar keeps TMDB's order and both of its title strings. A stored film
 * TMDB's page did not return is added in front, once, keyed by kind and tmdb id.
 */
export const mergeStoredIntoRemote = (
  remote: readonly TmdbCatalogResult[],
  stored: readonly StoredCatalogHit[],
): TmdbCatalogResult[] => {
  const seen = new Set(remote.map((hit) => `${hit.kind}:${hit.tmdbId}`));
  const extra: TmdbCatalogResult[] = [];
  for (const hit of stored) {
    const key = `${hit.kind}:${hit.tmdbId}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    extra.push(toSearchResult(hit));
  }
  return extra.length > 0 ? [...extra, ...remote] : [...remote];
};
