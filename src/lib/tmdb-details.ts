import {
  parseTmdbPeople,
  type TmdbCreatedBy,
  type TmdbCreditsPayload,
  type TmdbPerson,
} from "@/lib/tmdb-people";

/**
 * A title's TMDB details, parsed (FIL-20). `getTmdbDetails` asks TMDB for
 * details + keywords + credits in one call; for a long-running series
 * `aggregate_credits` alone is megabytes (SVU: 7 620 cast, 2.7 MB) and we keep
 * eight people. So the cache holds what this module returns, never TMDB's raw
 * payload: Vercel refuses entries over 2 MB and the rest would waste space.
 */

export type TmdbGenre = {
  id: number;
  name: string;
};

export type TmdbKeyword = { id: number; name: string };

export type TmdbKeywordsPayload = {
  keywords?: Array<{ id?: number; name?: string }>;
  results?: Array<{ id?: number; name?: string }>;
};

export type TmdbMovieDetailsPayload = {
  id: number;
  title: string;
  original_title?: string;
  original_language?: string;
  release_date?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  overview?: string;
  runtime?: number | null;
  genres?: Array<{ id?: number; name?: string }>;
  keywords?: TmdbKeywordsPayload;
  credits?: TmdbCreditsPayload;
};

export type TmdbTvDetailsPayload = {
  id: number;
  name: string;
  original_name?: string;
  original_language?: string;
  first_air_date?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  overview?: string;
  episode_run_time?: number[];
  genres?: Array<{ id?: number; name?: string }>;
  keywords?: TmdbKeywordsPayload;
  aggregate_credits?: TmdbCreditsPayload;
  created_by?: TmdbCreatedBy;
};

export type TmdbDetails = {
  tmdbId: number;
  name: string;
  originalName: string | null;
  originalLanguage: string | null;
  year: number | null;
  posterPath: string | null;
  backdropPath: string | null;
  overview: string | null;
  runtimeMinutes: number | null;
  genres: TmdbGenre[];
  keywords: TmdbKeyword[];
  people: TmdbPerson[];
};

export const parseTmdbYear = (value: string | null | undefined) => {
  if (!value) {
    return null;
  }

  const year = Number(value.slice(0, 4));
  return Number.isInteger(year) ? year : null;
};

export const parseTmdbGenres = (value: unknown): TmdbGenre[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const genres: TmdbGenre[] = [];
  const seen = new Set<number>();

  for (const item of value) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const raw = item as { id?: unknown; name?: unknown };
    const id = Number(raw.id);
    const name = typeof raw.name === "string" ? raw.name.trim() : "";
    if (!Number.isInteger(id) || id <= 0 || !name || seen.has(id)) {
      continue;
    }

    seen.add(id);
    genres.push({ id, name });
  }

  return genres;
};

export const parseTmdbRuntimeMinutes = (data: {
  runtime?: number | null;
  episode_run_time?: number[] | null;
}) => {
  if (typeof data.runtime === "number" && data.runtime > 0) {
    return data.runtime;
  }

  const episode = data.episode_run_time?.find((value) => value > 0);
  return episode ?? null;
};

export const parseTmdbKeywords = (payload: TmdbKeywordsPayload | null | undefined): TmdbKeyword[] => {
  const raw = payload?.keywords ?? payload?.results ?? [];
  const seen = new Set<number>();
  const keywords: TmdbKeyword[] = [];
  for (const item of raw) {
    const id = Number(item?.id);
    const name = item?.name?.trim();
    if (!Number.isInteger(id) || id <= 0 || !name || seen.has(id)) {
      continue;
    }
    seen.add(id);
    keywords.push({ id, name });
  }
  return keywords;
};

/**
 * TV keywords come back under `results`, movies under `keywords`;
 * parseTmdbKeywords handles both. `overview` is TMDB's es-MX text or null
 * (the caller fills it from other languages).
 */
export const parseTmdbDetails = (
  data: TmdbMovieDetailsPayload | TmdbTvDetailsPayload,
): TmdbDetails => {
  const genres = parseTmdbGenres(data.genres);
  const keywords = parseTmdbKeywords(data.keywords);
  const overview = data.overview?.trim() || null;
  const originalLanguage = data.original_language?.trim() || null;

  if ("title" in data) {
    return {
      tmdbId: data.id,
      name: data.title,
      originalName: data.original_title ?? null,
      originalLanguage,
      year: parseTmdbYear(data.release_date),
      posterPath: data.poster_path ?? null,
      backdropPath: data.backdrop_path ?? null,
      overview,
      runtimeMinutes: parseTmdbRuntimeMinutes(data),
      genres,
      keywords,
      people: parseTmdbPeople(data.credits, undefined),
    };
  }

  return {
    tmdbId: data.id,
    name: data.name,
    originalName: data.original_name ?? null,
    originalLanguage,
    year: parseTmdbYear(data.first_air_date),
    posterPath: data.poster_path ?? null,
    backdropPath: data.backdrop_path ?? null,
    overview,
    runtimeMinutes: parseTmdbRuntimeMinutes(data),
    genres,
    keywords,
    people: parseTmdbPeople(data.aggregate_credits, data.created_by),
  };
};
