import { TitleKind } from "@/generated/prisma/client";

const TMDB_BASE = "https://api.themoviedb.org/3";

const getTmdbApiKey = () => process.env.TMDB_API_KEY?.trim() ?? "";

export const isTmdbConfigured = () => Boolean(getTmdbApiKey());

export const tmdbPosterUrl = (
  posterPath: string | null | undefined,
  size: "w185" | "w342" | "w500" = "w342",
) => {
  if (!posterPath) {
    return null;
  }

  return `https://image.tmdb.org/t/p/${size}${posterPath}`;
};

type TmdbSearchResult = {
  tmdbId: number;
  name: string;
  originalName: string | null;
  year: number | null;
  posterPath: string | null;
  overview: string | null;
};

type TmdbExternalIds = {
  imdb_id: string | null;
};

const tmdbFetch = async <T>(path: string, params: Record<string, string> = {}) => {
  const apiKey = getTmdbApiKey();
  if (!apiKey) {
    throw new Error("TMDB_API_KEY no está configurada.");
  }

  const url = new URL(`${TMDB_BASE}${path}`);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("language", "es-MX");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url, { next: { revalidate: 86400 } });
  if (!response.ok) {
    throw new Error(`TMDB respondió ${response.status}.`);
  }

  return response.json() as Promise<T>;
};

const parseYear = (value: string | null | undefined) => {
  if (!value) {
    return null;
  }

  const year = Number(value.slice(0, 4));
  return Number.isInteger(year) ? year : null;
};

export const searchTmdb = async (
  query: string,
  kind: TitleKind,
  year?: number | null,
): Promise<TmdbSearchResult[]> => {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }

  const endpoint = kind === TitleKind.SERIES ? "/search/tv" : "/search/movie";
  const params: Record<string, string> = { query: trimmed };
  if (year) {
    params.year = String(year);
  }

  type MovieResult = {
    id: number;
    title: string;
    original_title?: string;
    release_date?: string;
    poster_path?: string | null;
    overview?: string;
  };

  type TvResult = {
    id: number;
    name: string;
    original_name?: string;
    first_air_date?: string;
    poster_path?: string | null;
    overview?: string;
  };

  const data = await tmdbFetch<{ results: Array<MovieResult | TvResult> }>(
    endpoint,
    params,
  );

  return data.results.slice(0, 8).map((item) => {
    if ("title" in item) {
      return {
        tmdbId: item.id,
        name: item.title,
        originalName: item.original_title ?? null,
        year: parseYear(item.release_date),
        posterPath: item.poster_path ?? null,
        overview: item.overview ?? null,
      };
    }

    return {
      tmdbId: item.id,
      name: item.name,
      originalName: item.original_name ?? null,
      year: parseYear(item.first_air_date),
      posterPath: item.poster_path ?? null,
      overview: item.overview ?? null,
    };
  });
};

export const getTmdbExternalIds = async (
  tmdbId: number,
  kind: TitleKind,
): Promise<string | null> => {
  const segment = kind === TitleKind.SERIES ? "tv" : "movie";
  const data = await tmdbFetch<TmdbExternalIds>(`/${segment}/${tmdbId}/external_ids`);
  return data.imdb_id ?? null;
};

export const getTmdbDetails = async (tmdbId: number, kind: TitleKind) => {
  const segment = kind === TitleKind.SERIES ? "tv" : "movie";
  type MovieDetails = {
    id: number;
    title: string;
    original_title?: string;
    release_date?: string;
    poster_path?: string | null;
  };
  type TvDetails = {
    id: number;
    name: string;
    original_name?: string;
    first_air_date?: string;
    poster_path?: string | null;
  };

  const data = await tmdbFetch<MovieDetails | TvDetails>(`/${segment}/${tmdbId}`);

  if ("title" in data) {
    return {
      tmdbId: data.id,
      name: data.title,
      originalName: data.original_title ?? null,
      year: parseYear(data.release_date),
      posterPath: data.poster_path ?? null,
    };
  }

  return {
    tmdbId: data.id,
    name: data.name,
    originalName: data.original_name ?? null,
    year: parseYear(data.first_air_date),
    posterPath: data.poster_path ?? null,
  };
};
