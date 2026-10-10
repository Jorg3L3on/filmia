import { unstable_cache } from "next/cache";
import { cache } from "react";
import { TitleKind } from "@/db";
import {
  parseFilmography,
  summarizeFilmography,
  type DirectorHit,
  type PersonFilmography,
  type PersonRole,
  type TmdbCombinedCredits,
} from "@/lib/person-filmography";
import {
  METADATA_REVALIDATE_SECONDS,
  TMDB_CACHE_TAG,
} from "@/lib/rendering";
import {
  parseTmdbPeople,
  type TmdbCreatedBy,
  type TmdbCreditsPayload,
  type TmdbPerson,
} from "@/lib/tmdb-people";

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

const INFRA_LEAK = /TMDB_API_KEY|\.env\b|api[_-]?key/i;

const hideInfraDump = (message: string) =>
  INFRA_LEAK.test(message) ? TMDB_UNAVAILABLE_COPY : message;

export const tmdbErrorMessage = (error: unknown) => {
  if (error instanceof TmdbRequestError) {
    if (
      error.code === "missing_key" ||
      error.status === 401 ||
      error.status === 403
    ) {
      return TMDB_UNAVAILABLE_COPY;
    }
    if (error.code === "http") {
      return "No se pudo completar la búsqueda. Inténtalo de nuevo.";
    }
    return hideInfraDump(error.message);
  }

  if (error instanceof TypeError) {
    return "No se pudo conectar con TMDB. Revisa tu red.";
  }

  if (error instanceof Error && error.message.trim()) {
    return hideInfraDump(error.message);
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

  try {
    return (await loadCachedTmdbJson(path, url.search)) as T;
  } catch (error) {
    if (error instanceof TmdbRequestError) {
      throw error;
    }
    // Outside a Next request scope (scripts, cron workers) unstable_cache has no
    // incremental cache: fall through to the plain fetch instead of failing.
    try {
      return (await fetchTmdbJson(path, url.search)) as T;
    } catch (direct) {
      if (direct instanceof TmdbRequestError) {
        throw direct;
      }
      throw new TmdbRequestError(
        "network",
        "No se pudo conectar con TMDB. Revisa tu red.",
      );
    }
  }
};

const fetchTmdbJson = async (path: string, search: string): Promise<unknown> => {
  const apiKey = getTmdbApiKey();
  if (!apiKey) {
    throw new TmdbRequestError(
      "missing_key",
      "Falta TMDB_API_KEY. Agrégala en el entorno para buscar títulos.",
    );
  }

  const url = new URL(`${TMDB_BASE}${path}${search}`);
  const headers: Record<string, string> = { Accept: "application/json" };
  if (isTmdbAccessToken(apiKey)) {
    headers.Authorization = `Bearer ${apiKey}`;
  } else {
    url.searchParams.set("api_key", apiKey);
  }

  let response: Response;
  try {
    response = await fetch(url, {
      next: {
        revalidate: METADATA_REVALIDATE_SECONDS,
        tags: [TMDB_CACHE_TAG],
      },
      headers,
    });
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

  return response.json() as Promise<unknown>;
};

const loadCachedTmdbJson = unstable_cache(fetchTmdbJson, ["tmdb-json"], {
  revalidate: METADATA_REVALIDATE_SECONDS,
  tags: [TMDB_CACHE_TAG],
});

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

export type TmdbDiscoverSort = "popularity.desc" | "vote_count.desc" | "vote_average.desc";

export type TmdbDiscoverOptions = {
  /** MOVIE (default) → /discover/movie, SERIES → /discover/tv. */
  kind?: TitleKind;
  /** `primary_release_year` for movies, `first_air_date_year` for series. */
  year?: number;
  sortBy?: TmdbDiscoverSort;
  voteCountGte?: number;
  /** Release-date region (ISO 3166-1), e.g. "MX". */
  region?: string;
  /** TMDB provider ids, OR-joined; needs `watchRegion`. */
  withWatchProviders?: readonly number[];
  watchRegion?: string;
  watchMonetizationTypes?: "flatrate";
  /** TMDB genre ids, AND-joined (a title must carry all of them). */
  withGenres?: readonly number[];
  page?: number;
};

export type TmdbDiscoverResult = TmdbCatalogResult & {
  voteAverage: number | null;
  voteCount: number;
  popularity: number;
  /** TMDB genre ids straight from the list payload: a taste signal with no extra call. */
  genreIds: number[];
};

type TmdbDiscoverItem = {
  id: number;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  overview?: string;
  vote_average?: number;
  vote_count?: number;
  popularity?: number;
  genre_ids?: number[];
};

const toDiscoverResult = (
  item: TmdbDiscoverItem,
  kind: TitleKind,
): TmdbDiscoverResult | null => {
  const name = (kind === "SERIES" ? item.name : item.title)?.trim() ?? "";
  if (!name) {
    return null;
  }
  return {
    tmdbId: item.id,
    name,
    originalName: (kind === "SERIES" ? item.original_name : item.original_title) ?? null,
    year: parseYear(kind === "SERIES" ? item.first_air_date : item.release_date),
    posterPath: item.poster_path ?? null,
    backdropPath: item.backdrop_path ?? null,
    overview: item.overview ?? null,
    kind,
    voteAverage: typeof item.vote_average === "number" && item.vote_average > 0 ? item.vote_average : null,
    voteCount: item.vote_count ?? 0,
    popularity: item.popularity ?? 0,
    genreIds: Array.isArray(item.genre_ids) ? item.genre_ids.filter(Number.isInteger) : [],
  };
};

/**
 * TMDB /discover — popular releases of a year, or what streams flatrate on given providers.
 * Goes through `tmdbFetch`, so results share the 24 h metadata cache.
 */
export const discoverTmdb = async (
  options: TmdbDiscoverOptions = {},
): Promise<TmdbDiscoverResult[]> => {
  const kind: TitleKind = options.kind ?? "MOVIE";
  const params: Record<string, string> = {
    sort_by: options.sortBy ?? "popularity.desc",
    include_adult: "false",
    page: String(options.page ?? 1),
  };
  if (options.year) {
    params[kind === "SERIES" ? "first_air_date_year" : "primary_release_year"] = String(options.year);
  }
  if (options.voteCountGte != null) {
    params["vote_count.gte"] = String(options.voteCountGte);
  }
  if (options.region) {
    params.region = options.region;
  }
  if (options.withGenres && options.withGenres.length > 0) {
    params.with_genres = [...options.withGenres].join(",");
  }
  if (options.withWatchProviders && options.withWatchProviders.length > 0) {
    params.with_watch_providers = [...options.withWatchProviders].join("|");
    params.watch_region = options.watchRegion ?? "MX";
    params.with_watch_monetization_types = options.watchMonetizationTypes ?? "flatrate";
  }

  const data = await tmdbFetch<{ results?: TmdbDiscoverItem[] }>(
    kind === "SERIES" ? "/discover/tv" : "/discover/movie",
    params,
  );

  return (data.results ?? []).flatMap((item) => {
    const result = toDiscoverResult(item, kind);
    return result ? [result] : [];
  });
};

export type TmdbRelatedKind = "recommendations" | "similar";

/**
 * TMDB `/{movie|tv}/{id}/recommendations` (what TMDB users pair with it) or
 * `/similar` (metadata match). Same result shape as `discoverTmdb`; goes through
 * `tmdbFetch`, so it shares the metadata cache. Never throws for a missing seed:
 * an unknown id is an empty list.
 */
export const getTmdbRelated = async (
  tmdbId: number,
  kind: TitleKind,
  relation: TmdbRelatedKind,
  page = 1,
): Promise<TmdbDiscoverResult[]> => {
  const segment = kind === "SERIES" ? "tv" : "movie";
  try {
    const data = await tmdbFetch<{ results?: TmdbDiscoverItem[] }>(
      `/${segment}/${tmdbId}/${relation}`,
      { page: String(page) },
    );
    return (data.results ?? []).flatMap((item) => {
      const result = toDiscoverResult(item, kind);
      return result ? [result] : [];
    });
  } catch (error) {
    if (error instanceof TmdbRequestError && error.status === 404) {
      return [];
    }
    throw error;
  }
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
  keywords?: TmdbKeyword[];
  people?: TmdbPerson[];
  originalLanguage?: string | null;
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

export type TmdbKeyword = { id: number; name: string };
export {
  parseTmdbPeople,
  type TmdbCreditsPayload,
  type TmdbPerson,
  type TmdbPersonRole,
} from "@/lib/tmdb-people";

type TmdbKeywordsPayload = {
  keywords?: Array<{ id?: number; name?: string }>;
  results?: Array<{ id?: number; name?: string }>;
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

export const getTmdbDetails = async (tmdbId: number, kind: TitleKind) => {
  const segment = kind === "SERIES" ? "tv" : "movie";
  type MovieDetails = {
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
  type TvDetails = {
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

  // One call: details + keywords + credits (Esta noche taste vector). TV keywords
  // come back under `results`, movies under `keywords`; parseTmdbKeywords handles both.
  const data = await tmdbFetch<MovieDetails | TvDetails>(`/${segment}/${tmdbId}`, {
    append_to_response: segment === "tv" ? "keywords,aggregate_credits" : "keywords,credits",
  });
  const genres = parseTmdbGenres(data.genres);
  const keywords = parseTmdbKeywords(data.keywords);
  const overview = await overviewWithFallback(
    segment,
    data.id,
    data.overview?.trim() || null,
  );
  const originalLanguage = data.original_language?.trim() || null;

  if ("title" in data) {
    return {
      tmdbId: data.id,
      name: data.title,
      originalName: data.original_title ?? null,
      originalLanguage,
      year: parseYear(data.release_date),
      posterPath: data.poster_path ?? null,
      backdropPath: data.backdrop_path ?? null,
      overview,
      runtimeMinutes: parseRuntimeMinutes(data),
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
    year: parseYear(data.first_air_date),
    posterPath: data.poster_path ?? null,
    backdropPath: data.backdrop_path ?? null,
    overview,
    runtimeMinutes: parseRuntimeMinutes(data),
    genres,
    keywords,
    people: parseTmdbPeople(data.aggregate_credits, data.created_by),
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
      keywords: details.keywords,
      people: details.people,
      originalLanguage: details.originalLanguage,
    };
  } catch {
    return null;
  }
});

// ---------------------------------------------------------------------------
// People (FIL-I3-5): Buscar's Director chip, the «Ver filmografía» suggestion
// and the person view (/buscar?persona=<id>&rol=…). Parsing lives in
// person-filmography.ts; this block only fetches (same 24 h cache).
// ---------------------------------------------------------------------------

export const tmdbProfileUrl = (profilePath: string | null | undefined, size: "w185" | "h632" = "w185") =>
  profilePath ? `https://image.tmdb.org/t/p/${size}${profilePath}` : null;

type TmdbPersonHit = {
  id: number;
  media_type?: string;
  name?: string;
  known_for_department?: string;
  profile_path?: string | null;
  popularity?: number;
};

const DIRECTING_DEPARTMENT = "Directing";

const toDirectorHits = (people: readonly TmdbPersonHit[]): DirectorHit[] =>
  people.flatMap((person) =>
    person.known_for_department === DIRECTING_DEPARTMENT && person.name?.trim()
      ? [
          {
            id: person.id,
            name: person.name.trim(),
            profilePath: person.profile_path ?? null,
            popularity: person.popularity ?? 0,
          },
        ]
      : [],
  );

/** Directors among the people of `/search/multi` (same request as searchTmdbMulti, cached). */
export const searchTmdbMultiDirectors = async (query: string): Promise<DirectorHit[]> => {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }
  const data = await tmdbFetch<{ results: TmdbPersonHit[] }>("/search/multi", { query: trimmed });
  return toDirectorHits(data.results.filter((item) => item.media_type === "person"));
};

/** Director chip: `/search/person`, keeping people known for Directing. */
export const searchTmdbDirectors = async (query: string): Promise<DirectorHit[]> => {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }
  const data = await tmdbFetch<{ results: TmdbPersonHit[] }>("/search/person", { query: trimmed });
  return toDirectorHits(data.results).slice(0, 8);
};

/** Just the photo; shares the cached `/person/:id` response with the filmography. */
export const getTmdbPersonProfilePath = async (personId: number): Promise<string | null> => {
  const person = await tmdbFetch<{ profile_path?: string | null }>(`/person/${personId}`);
  return person.profile_path ?? null;
};

/** One filmography per person and role (director | reparto | fotografia). */
export const getTmdbPersonFilmography = async (
  personId: number,
  role: PersonRole,
): Promise<PersonFilmography> => {
  const [person, credits] = await Promise.all([
    tmdbFetch<{
      id: number;
      name?: string;
      profile_path?: string | null;
      known_for_department?: string;
    }>(`/person/${personId}`),
    tmdbFetch<TmdbCombinedCredits>(`/person/${personId}/combined_credits`),
  ]);
  return summarizeFilmography(
    {
      id: person.id,
      name: person.name?.trim() || "",
      profilePath: person.profile_path ?? null,
      department: person.known_for_department ?? null,
    },
    role,
    parseFilmography(credits, role),
  );
};
