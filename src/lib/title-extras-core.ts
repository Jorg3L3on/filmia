import { parseStoredTmdbGenres } from "@/lib/diary-picks";
import type { TmdbGenre, TmdbKeyword, TmdbPerson, TmdbTitleExtras } from "@/lib/tmdb";

type TitleKind = "MOVIE" | "SERIES";

const extrasSynopsis = (overview?: string | null) => {
  const text = overview?.trim();
  return text ? text : null;
};

export type TitleExtrasRow = {
  id: string;
  userId: string;
  tmdbId: number | null;
  kind: TitleKind;
  posterPath: string | null;
  overview: string | null;
  tmdbGenres?: unknown;
  runtimeMinutes?: number | null;
  backdropPath?: string | null;
  tmdbKeywords?: unknown;
  tmdbPeople?: unknown;
  originalLanguage?: string | null;
};

export type TitleExtrasPatch = {
  overview?: string;
  posterPath?: string;
  backdropPath?: string;
  runtimeMinutes?: number;
  tmdbGenres?: TmdbGenre[];
  tmdbId?: number;
  tmdbKeywords?: TmdbKeyword[];
  tmdbPeople?: TmdbPerson[];
  originalLanguage?: string;
};

const storedArrayLength = (value: unknown) => (Array.isArray(value) ? value.length : 0);

/** Esta noche needs keywords + people; refetch when a TMDB title has none stored. */
export const titleNeedsTasteFeatures = (title: Pick<TitleExtrasRow, "tmdbId" | "tmdbKeywords" | "tmdbPeople">) =>
  Boolean(title.tmdbId) &&
  storedArrayLength(title.tmdbKeywords) === 0 &&
  storedArrayLength(title.tmdbPeople) === 0;

export type FetchedTitleExtras = TmdbTitleExtras & {
  tmdbId?: number | null;
};

export const storedTitleExtras = (title: TitleExtrasRow): TmdbTitleExtras => ({
  overview: extrasSynopsis(title.overview),
  runtimeMinutes: title.runtimeMinutes && title.runtimeMinutes > 0 ? title.runtimeMinutes : null,
  backdropPath: title.backdropPath?.trim() || null,
  posterPath: title.posterPath?.trim() || null,
  genres: parseStoredTmdbGenres(title.tmdbGenres),
});

/** Fetch TMDB when poster, overview, or genres are still missing. Runtime fills in opportunistically. */
export const titleNeedsTmdbExtras = (title: TitleExtrasRow) => {
  if (!title.tmdbId) {
    return false;
  }

  const stored = storedTitleExtras(title);
  return !stored.posterPath || !stored.overview || stored.genres.length === 0;
};

export const titleExtrasPatch = (
  current: TitleExtrasRow,
  fetched: FetchedTitleExtras,
): TitleExtrasPatch => {
  const stored = storedTitleExtras(current);
  const patch: TitleExtrasPatch = {};
  const overview = extrasSynopsis(fetched.overview);
  const posterPath = fetched.posterPath?.trim() || null;
  const backdropPath = fetched.backdropPath?.trim() || null;
  const runtimeMinutes =
    fetched.runtimeMinutes && fetched.runtimeMinutes > 0 ? fetched.runtimeMinutes : null;

  if (overview && !stored.overview) {
    patch.overview = overview;
  }

  if (posterPath && !stored.posterPath) {
    patch.posterPath = posterPath;
  }

  if (backdropPath && !stored.backdropPath) {
    patch.backdropPath = backdropPath;
  }

  if (runtimeMinutes && !stored.runtimeMinutes) {
    patch.runtimeMinutes = runtimeMinutes;
  }

  if (fetched.genres.length > 0 && stored.genres.length === 0) {
    patch.tmdbGenres = fetched.genres;
  }

  if (fetched.tmdbId && !current.tmdbId) {
    patch.tmdbId = fetched.tmdbId;
  }

  if (fetched.keywords && fetched.keywords.length > 0 && storedArrayLength(current.tmdbKeywords) === 0) {
    patch.tmdbKeywords = fetched.keywords;
  }

  if (fetched.people && fetched.people.length > 0 && storedArrayLength(current.tmdbPeople) === 0) {
    patch.tmdbPeople = fetched.people;
  }

  if (fetched.originalLanguage && !current.originalLanguage) {
    patch.originalLanguage = fetched.originalLanguage;
  }

  return patch;
};

export const mergeTitleExtras = (
  current: TitleExtrasRow,
  fetched: FetchedTitleExtras,
): TmdbTitleExtras => {
  const stored = storedTitleExtras(current);
  const posterPath = fetched.posterPath?.trim() || null;

  return {
    overview: stored.overview ?? extrasSynopsis(fetched.overview),
    runtimeMinutes: stored.runtimeMinutes ?? fetched.runtimeMinutes,
    backdropPath: stored.backdropPath ?? fetched.backdropPath,
    posterPath: stored.posterPath ?? posterPath,
    genres: stored.genres.length > 0 ? stored.genres : fetched.genres,
  };
};
