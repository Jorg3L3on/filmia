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

export type TmdbAlternativeTitle = {
  iso_3166_1?: string;
  title?: string;
  type?: string;
};

/** Movies return `titles`; series return `results`. */
export type TmdbAlternativeTitlesPayload = {
  titles?: TmdbAlternativeTitle[];
  results?: TmdbAlternativeTitle[];
};

export type TmdbTranslation = {
  iso_3166_1?: string;
  iso_639_1?: string;
  data?: { title?: string; name?: string };
};

export type TmdbTranslationsPayload = {
  translations?: TmdbTranslation[];
};

/**
 * One details call (FIL-I48-1). Keywords and credits stay; alternative titles
 * and translations ride along so the Mexican, original, and en-US names do
 * not cost a second request.
 */
export const tmdbDetailsAppendToResponse = (segment: "movie" | "tv") =>
  segment === "tv"
    ? "keywords,aggregate_credits,alternative_titles,translations"
    : "keywords,credits,alternative_titles,translations";

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
  alternative_titles?: TmdbAlternativeTitlesPayload;
  translations?: TmdbTranslationsPayload;
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
  /** Many series leave `episode_run_time` empty; the last aired episode still carries its runtime. */
  last_episode_to_air?: { runtime?: number | null } | null;
  next_episode_to_air?: { runtime?: number | null } | null;
  genres?: Array<{ id?: number; name?: string }>;
  keywords?: TmdbKeywordsPayload;
  aggregate_credits?: TmdbCreditsPayload;
  created_by?: TmdbCreatedBy;
  alternative_titles?: TmdbAlternativeTitlesPayload;
  translations?: TmdbTranslationsPayload;
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
  /** Search strings other than `name`: MX, original, en-US when different. */
  alternateNames: string[];
};

export const parseTmdbYear = (value: string | null | undefined) => {
  if (!value) {
    return null;
  }

  const year = Number(value.slice(0, 4));
  return Number.isInteger(year) ? year : null;
};

/**
 * TMDB's TV genres that pair two film genres, or have an English name in es-MX (UX-08). Each is
 * read as its film equivalents, so filters and lenses show one Spanish chip per genre.
 */
const TV_GENRE_EQUIVALENTS: Record<number, TmdbGenre[]> = {
  10759: [
    { id: 28, name: "Acción" },
    { id: 12, name: "Aventura" },
  ],
  10765: [
    { id: 878, name: "Ciencia ficción" },
    { id: 14, name: "Fantasía" },
  ],
  10768: [{ id: 10752, name: "Bélica" }],
  10762: [{ id: 10762, name: "Infantil" }],
  10763: [{ id: 10763, name: "Noticias" }],
  10764: [{ id: 10764, name: "Reality" }],
  10766: [{ id: 10766, name: "Telenovela" }],
  10767: [{ id: 10767, name: "Entrevistas" }],
};

/** Raw TMDB ids to match in stored JSON for these (already merged) genre ids: TV ids included. */
export const storedGenreIdsFor = (ids: readonly number[]) => {
  const wanted = new Set(ids);
  for (const [tvId, equivalents] of Object.entries(TV_GENRE_EQUIVALENTS)) {
    if (equivalents.some((genre) => wanted.has(genre.id))) wanted.add(Number(tvId));
  }
  return [...wanted];
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

    for (const genre of TV_GENRE_EQUIVALENTS[id] ?? [{ id, name }]) {
      if (!seen.has(genre.id)) {
        seen.add(genre.id);
        genres.push(genre);
      }
    }
  }

  return genres;
};

/** Movies: `runtime`. Series: the episode runtime, from `episode_run_time` or, when TMDB leaves it empty (FIL-I24-7), the last or next episode aired. */
export const parseTmdbRuntimeMinutes = (data: {
  runtime?: number | null;
  episode_run_time?: number[] | null;
  last_episode_to_air?: { runtime?: number | null } | null;
  next_episode_to_air?: { runtime?: number | null } | null;
}) => {
  if (typeof data.runtime === "number" && data.runtime > 0) {
    return data.runtime;
  }

  const episode = data.episode_run_time?.find((value) => value > 0);
  if (episode) {
    return episode;
  }
  for (const aired of [data.last_episode_to_air, data.next_episode_to_air]) {
    if (typeof aired?.runtime === "number" && aired.runtime > 0) {
      return aired.runtime;
    }
  }
  return null;
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

const cleanTitle = (value: string | null | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

/** Case-insensitive. Accents stay different: «año» is not «ano». */
const sameTitle = (left: string, right: string | null) =>
  right != null && left.localeCompare(right, "es-MX", { sensitivity: "accent" }) === 0;

const MAX_ALTERNATE_NAMES = 8;

/** MX alternative titles, in TMDB's order, without empty or repeated strings. */
export const mxAlternativeTitles = (
  payload: TmdbAlternativeTitlesPayload | null | undefined,
): string[] => {
  const raw = payload?.titles ?? payload?.results ?? [];
  const seen = new Set<string>();
  const titles: string[] = [];

  for (const item of raw) {
    if (item?.iso_3166_1 !== "MX") {
      continue;
    }
    const title = cleanTitle(item.title);
    if (!title) {
      continue;
    }
    const key = title.toLocaleLowerCase("es-MX");
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    titles.push(title);
  }

  return titles;
};

/** en-US translation. Movies put it on `data.title`, series on `data.name`. */
export const enUsTitle = (payload: TmdbTranslationsPayload | null | undefined) => {
  for (const item of payload?.translations ?? []) {
    if (item?.iso_3166_1 !== "US" || item.iso_639_1 !== "en") {
      continue;
    }
    const title = cleanTitle(item.data?.title) ?? cleanTitle(item.data?.name);
    if (title) {
      return title;
    }
  }
  return null;
};

/**
 * Name preference (FIL-I48-1):
 * - Mexican-facing `name` is the first MX alternative that differs from the
 *   original title. When TMDB has none, `name` stays the es-MX title.
 * - `originalName` is the original title.
 * - `alternateNames` is a short search list: that MX title, the original,
 *   and the en-US title when it differs. `name` is not repeated.
 */
export const resolveCatalogTitles = (input: {
  esMxName: string | null | undefined;
  originalName: string | null | undefined;
  mxTitles: readonly string[];
  enUsName: string | null | undefined;
}) => {
  const original = cleanTitle(input.originalName);
  const esMx = cleanTitle(input.esMxName);
  const mxTitles = input.mxTitles
    .map((title) => cleanTitle(title))
    .filter((title): title is string => Boolean(title));
  const mxFacing = mxTitles.find((title) => !sameTitle(title, original)) ?? null;
  const name = mxFacing ?? esMx ?? original ?? "";
  const alternateNames: string[] = [];

  const push = (value: string | null) => {
    if (!value || alternateNames.length >= MAX_ALTERNATE_NAMES) {
      return;
    }
    if (sameTitle(value, name) || alternateNames.some((existing) => sameTitle(value, existing))) {
      return;
    }
    alternateNames.push(value);
  };

  push(mxFacing ?? mxTitles[0] ?? null);
  push(original);
  push(cleanTitle(input.enUsName));

  return { name, originalName: original, alternateNames };
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
  const titles = resolveCatalogTitles({
    esMxName: "title" in data ? data.title : data.name,
    originalName: "title" in data ? data.original_title : data.original_name,
    mxTitles: mxAlternativeTitles(data.alternative_titles),
    enUsName: enUsTitle(data.translations),
  });

  if ("title" in data) {
    return {
      tmdbId: data.id,
      name: titles.name || data.title,
      originalName: titles.originalName,
      alternateNames: titles.alternateNames,
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
    name: titles.name || data.name,
    originalName: titles.originalName,
    alternateNames: titles.alternateNames,
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
