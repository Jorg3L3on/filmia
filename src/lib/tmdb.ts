import { cache } from "react";
import { TitleKind } from "@/db";

const TMDB_BASE = "https://api.themoviedb.org/3";

const getTmdbApiKey = () => process.env.TMDB_API_KEY?.trim() ?? "";

export const isTmdbConfigured = () => Boolean(getTmdbApiKey());

export const tmdbBackdropUrl = (
  backdropPath: string | null | undefined,
  size: "w780" | "w1280" = "w780",
) => {
  if (!backdropPath) {
    return null;
  }

  if (backdropPath.startsWith("http://") || backdropPath.startsWith("https://")) {
    return backdropPath;
  }

  return `https://image.tmdb.org/t/p/${size}${backdropPath}`;
};

export const tmdbPosterUrl = (
  posterPath: string | null | undefined,
  size: "w185" | "w342" | "w500" = "w342",
) => {
  if (!posterPath) {
    return null;
  }

  if (posterPath.startsWith("http://") || posterPath.startsWith("https://")) {
    return posterPath;
  }

  if (posterPath.startsWith("/posters/")) {
    return posterPath;
  }

  return `https://image.tmdb.org/t/p/${size}${posterPath}`;
};

export type TmdbSearchResult = {
  tmdbId: number;
  name: string;
  originalName: string | null;
  year: number | null;
  posterPath: string | null;
  backdropPath: string | null;
  overview: string | null;
};

export type TmdbCatalogResult = TmdbSearchResult & {
  kind: TitleKind;
};

export type TmdbGenre = {
  id: number;
  name: string;
};

type TmdbExternalIds = {
  imdb_id: string | null;
};

export type TmdbErrorCode = "missing_key" | "rate_limit" | "network" | "http";

export class TmdbRequestError extends Error {
  readonly code: TmdbErrorCode;
  readonly status: number | null;

  constructor(code: TmdbErrorCode, message: string, status: number | null = null) {
    super(message);
    this.name = "TmdbRequestError";
    this.code = code;
    this.status = status;
  }
}

export const TMDB_UNAVAILABLE_COPY =
  "No se puede buscar títulos ahora. Tu diario y tus listas siguen disponibles.";

export const tmdbErrorMessage = (error: unknown) => {
  if (error instanceof TmdbRequestError) {
    return error.code === "missing_key" ? TMDB_UNAVAILABLE_COPY : error.message;
  }

  if (error instanceof TypeError) {
    return "No se pudo conectar con TMDB. Revisa tu red.";
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "No se pudo completar la petición a TMDB.";
};

const isTmdbAccessToken = (apiKey: string) => apiKey.startsWith("eyJ");

const TMDB_LANGUAGE = "es-MX";
const OVERVIEW_FALLBACK_LANGUAGES = ["es-ES", "en-US"] as const;

const tmdbFetch = async <T>(path: string, params: Record<string, string> = {}) => {
  const apiKey = getTmdbApiKey();
  if (!apiKey) {
    throw new TmdbRequestError(
      "missing_key",
      "Falta TMDB_API_KEY. Agrégala en el entorno para buscar títulos.",
    );
  }

  const url = new URL(`${TMDB_BASE}${path}`);
  url.searchParams.set("language", TMDB_LANGUAGE);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const headers: Record<string, string> = { Accept: "application/json" };
  if (isTmdbAccessToken(apiKey)) {
    headers.Authorization = `Bearer ${apiKey}`;
  } else {
    url.searchParams.set("api_key", apiKey);
  }

  let response: Response;
  try {
    response = await fetch(url, { next: { revalidate: 86400 }, headers });
  } catch {
    throw new TmdbRequestError(
      "network",
      "No se pudo conectar con TMDB. Revisa tu red.",
    );
  }

  if (response.status === 429) {
    throw new TmdbRequestError(
      "rate_limit",
      "TMDB está limitando las peticiones. Espera un momento e inténtalo de nuevo.",
      429,
    );
  }

  if (!response.ok) {
    throw new TmdbRequestError(
      "http",
      `TMDB respondió ${response.status}.`,
      response.status,
    );
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

  const endpoint = kind === "SERIES" ? "/search/tv" : "/search/movie";
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
    backdrop_path?: string | null;
    overview?: string;
  };

  type TvResult = {
    id: number;
    name: string;
    original_name?: string;
    first_air_date?: string;
    poster_path?: string | null;
    backdrop_path?: string | null;
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
        backdropPath: item.backdrop_path ?? null,
        overview: item.overview ?? null,
      };
    }

    return {
      tmdbId: item.id,
      name: item.name,
      originalName: item.original_name ?? null,
      year: parseYear(item.first_air_date),
      posterPath: item.poster_path ?? null,
      backdropPath: item.backdrop_path ?? null,
      overview: item.overview ?? null,
    };
  });
};

export const searchTmdbMulti = async (
  query: string,
): Promise<TmdbCatalogResult[]> => {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }

  type MultiResult = {
    id: number;
    media_type?: string;
    title?: string;
    name?: string;
    original_title?: string;
    original_name?: string;
    release_date?: string;
    first_air_date?: string;
    poster_path?: string | null;
    backdrop_path?: string | null;
    overview?: string;
  };

  const data = await tmdbFetch<{ results: MultiResult[] }>("/search/multi", {
    query: trimmed,
  });

  const results: TmdbCatalogResult[] = [];

  for (const item of data.results) {
    if (results.length >= 16) {
      break;
    }

    if (item.media_type === "movie") {
      const name = item.title?.trim() ?? "";
      if (!name) {
        continue;
      }

      results.push({
        tmdbId: item.id,
        name,
        originalName: item.original_title ?? null,
        year: parseYear(item.release_date),
        posterPath: item.poster_path ?? null,
        backdropPath: item.backdrop_path ?? null,
        overview: item.overview ?? null,
        kind: "MOVIE",
      });
      continue;
    }

    if (item.media_type === "tv") {
      const name = item.name?.trim() ?? "";
      if (!name) {
        continue;
      }

      results.push({
        tmdbId: item.id,
        name,
        originalName: item.original_name ?? null,
        year: parseYear(item.first_air_date),
        posterPath: item.poster_path ?? null,
        backdropPath: item.backdrop_path ?? null,
        overview: item.overview ?? null,
        kind: "SERIES",
      });
    }
  }

  return results;
};

export const getTmdbExternalIds = async (
  tmdbId: number,
  kind: TitleKind,
): Promise<string | null> => {
  const segment = kind === "SERIES" ? "tv" : "movie";
  const data = await tmdbFetch<TmdbExternalIds>(`/${segment}/${tmdbId}/external_ids`);
  return data.imdb_id ?? null;
};

export const tmdbProviderLogoUrl = (
  logoPath: string | null | undefined,
  size: "w45" | "w92" = "w45",
) => {
  if (!logoPath) {
    return null;
  }

  return `https://image.tmdb.org/t/p/${size}${logoPath}`;
};

type TmdbWatchProvidersResponse = {
  id: number;
  results?: Record<
    string,
    {
      link?: string;
      flatrate?: Array<{
        provider_id: number;
        provider_name: string;
        logo_path?: string | null;
        display_priority?: number;
      }>;
      rent?: Array<{
        provider_id: number;
        provider_name: string;
        logo_path?: string | null;
        display_priority?: number;
      }>;
      buy?: Array<{
        provider_id: number;
        provider_name: string;
        logo_path?: string | null;
        display_priority?: number;
      }>;
    }
  >;
};

export const getTmdbWatchProviders = async (tmdbId: number, kind: TitleKind) => {
  const segment = kind === "SERIES" ? "tv" : "movie";
  return tmdbFetch<TmdbWatchProvidersResponse>(`/${segment}/${tmdbId}/watch/providers`);
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

export type TmdbTitleExtras = {
  overview: string | null;
  runtimeMinutes: number | null;
  backdropPath: string | null;
  posterPath: string | null;
  genres: TmdbGenre[];
};

const parseRuntimeMinutes = (data: {
  runtime?: number | null;
  episode_run_time?: number[] | null;
}) => {
  if (typeof data.runtime === "number" && data.runtime > 0) {
    return data.runtime;
  }

  const episode = data.episode_run_time?.find((value) => value > 0);
  return episode ?? null;
};

const overviewWithFallback = async (
  segment: "movie" | "tv",
  tmdbId: number,
  overview: string | null,
) => {
  if (overview) {
    return overview;
  }

  for (const language of OVERVIEW_FALLBACK_LANGUAGES) {
    const data = await tmdbFetch<{ overview?: string }>(`/${segment}/${tmdbId}`, {
      language,
    });
    const fallback = data.overview?.trim() || null;
    if (fallback) {
      return fallback;
    }
  }

  return null;
};

export const getTmdbDetails = async (tmdbId: number, kind: TitleKind) => {
  const segment = kind === "SERIES" ? "tv" : "movie";
  type MovieDetails = {
    id: number;
    title: string;
    original_title?: string;
    release_date?: string;
    poster_path?: string | null;
    backdrop_path?: string | null;
    overview?: string;
    runtime?: number | null;
    genres?: Array<{ id?: number; name?: string }>;
  };
  type TvDetails = {
    id: number;
    name: string;
    original_name?: string;
    first_air_date?: string;
    poster_path?: string | null;
    backdrop_path?: string | null;
    overview?: string;
    episode_run_time?: number[];
    genres?: Array<{ id?: number; name?: string }>;
  };

  const data = await tmdbFetch<MovieDetails | TvDetails>(`/${segment}/${tmdbId}`);
  const genres = parseTmdbGenres(data.genres);
  const overview = await overviewWithFallback(
    segment,
    data.id,
    data.overview?.trim() || null,
  );

  if ("title" in data) {
    return {
      tmdbId: data.id,
      name: data.title,
      originalName: data.original_title ?? null,
      year: parseYear(data.release_date),
      posterPath: data.poster_path ?? null,
      backdropPath: data.backdrop_path ?? null,
      overview,
      runtimeMinutes: parseRuntimeMinutes(data),
      genres,
    };
  }

  return {
    tmdbId: data.id,
    name: data.name,
    originalName: data.original_name ?? null,
    year: parseYear(data.first_air_date),
    posterPath: data.poster_path ?? null,
    backdropPath: data.backdrop_path ?? null,
    overview,
    runtimeMinutes: parseRuntimeMinutes(data),
    genres,
  };
};

export const getTmdbTitleExtras = cache(async (
  tmdbId: number,
  kind: TitleKind,
): Promise<TmdbTitleExtras | null> => {
  if (!isTmdbConfigured()) {
    return null;
  }

  try {
    const details = await getTmdbDetails(tmdbId, kind);

    return {
      overview: details.overview,
      runtimeMinutes: details.runtimeMinutes,
      backdropPath: details.backdropPath,
      posterPath: details.posterPath,
      genres: details.genres,
    };
  } catch {
    return null;
  }
});
