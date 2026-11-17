import type { TitleKind } from "@/db/schema";

export type TmdbDiscoverSort = "popularity.desc" | "vote_count.desc" | "vote_average.desc";

/**
 * TMDB series types for `with_type` on /discover/tv (TMDB's `type` field on a series):
 * 0 Documentary, 1 News, 2 Miniseries, 3 Reality, 4 Scripted, 5 Talk Show, 6 Video.
 */
export const TMDB_TV_TYPE = {
  documentary: 0,
  news: 1,
  miniseries: 2,
  reality: 3,
  scripted: 4,
  talkShow: 5,
  video: 6,
} as const;

export type TmdbDiscoverOptions = {
  /** MOVIE (default) → /discover/movie, SERIES → /discover/tv. */
  kind?: TitleKind;
  /** `primary_release_year` for movies, `first_air_date_year` for series. */
  year?: number;
  /**
   * Years, inclusive: `primary_release_date.gte` / `.lte` for movies (La tanda's epoch,
   * FIL-I50-3), `first_air_date.gte` / `.lte` for series (Para ti, FIL-I60-2).
   */
  yearFrom?: number;
  yearTo?: number;
  sortBy?: TmdbDiscoverSort;
  voteCountGte?: number;
  /** `vote_count.lte`: Para ti's «Joya escondida» wants good films few people rated. */
  voteCountLte?: number;
  /** `vote_average.gte`, TMDB's 0–10 average. */
  voteAverageGte?: number;
  /** `with_runtime.gte` / `.lte`, minutes (episode runtime for series). */
  runtimeGte?: number;
  runtimeLte?: number;
  /** Release-date region (ISO 3166-1), e.g. "MX" (TMDB reads it on /discover/movie). */
  region?: string;
  /** TMDB provider ids, OR-joined; needs `watchRegion`. */
  withWatchProviders?: readonly number[];
  watchRegion?: string;
  watchMonetizationTypes?: "flatrate";
  /** TMDB genre ids, AND-joined (a title must carry all of them). */
  withGenres?: readonly number[];
  /** TMDB genre ids, OR-joined (any of them). Not together with `withGenres`. */
  withAnyGenres?: readonly number[];
  /** TMDB genre ids to leave out, OR-joined (any of them excludes the title). */
  withoutGenres?: readonly number[];
  /** TMDB keyword ids, OR-joined (any of them). */
  withKeywords?: readonly number[];
  /** Series only: `with_type`, OR-joined (`TMDB_TV_TYPE`). */
  tvTypes?: readonly number[];
  page?: number;
};

/**
 * The query string of a TMDB /discover call. Parameter names are TMDB's own
 * (developer.themoviedb.org/reference/discover-movie and discover-tv): commas AND, pipes OR.
 */
export const discoverTmdbParams = (options: TmdbDiscoverOptions = {}): Record<string, string> => {
  const kind: TitleKind = options.kind ?? "MOVIE";
  const series = kind === "SERIES";
  const params: Record<string, string> = {
    sort_by: options.sortBy ?? "popularity.desc",
    include_adult: "false",
    page: String(options.page ?? 1),
  };
  if (options.year) {
    params[series ? "first_air_date_year" : "primary_release_year"] = String(options.year);
  }
  const dateKey = series ? "first_air_date" : "primary_release_date";
  if (options.yearFrom != null) {
    params[`${dateKey}.gte`] = `${options.yearFrom}-01-01`;
  }
  if (options.yearTo != null) {
    params[`${dateKey}.lte`] = `${options.yearTo}-12-31`;
  }
  if (options.voteCountGte != null) {
    params["vote_count.gte"] = String(options.voteCountGte);
  }
  if (options.voteCountLte != null) {
    params["vote_count.lte"] = String(options.voteCountLte);
  }
  if (options.voteAverageGte != null) {
    params["vote_average.gte"] = String(options.voteAverageGte);
  }
  if (options.runtimeGte != null) {
    params["with_runtime.gte"] = String(options.runtimeGte);
  }
  if (options.runtimeLte != null) {
    params["with_runtime.lte"] = String(options.runtimeLte);
  }
  if (options.region) {
    params.region = options.region;
  }
  const all = options.withGenres?.length ? [...options.withGenres].join(",") : "";
  const any = options.withAnyGenres?.length ? [...options.withAnyGenres].join("|") : "";
  if (all && any) {
    // TMDB has no grouping in one with_genres: run two queries instead.
    throw new Error("discoverTmdbParams: withGenres and withAnyGenres cannot be combined.");
  }
  if (all || any) {
    params.with_genres = all || any;
  }
  if (options.withoutGenres && options.withoutGenres.length > 0) {
    params.without_genres = [...options.withoutGenres].join("|");
  }
  if (options.withKeywords && options.withKeywords.length > 0) {
    params.with_keywords = [...options.withKeywords].join("|");
  }
  if (series && options.tvTypes && options.tvTypes.length > 0) {
    params.with_type = [...options.tvTypes].join("|");
  }
  if (options.withWatchProviders && options.withWatchProviders.length > 0) {
    params.with_watch_providers = [...options.withWatchProviders].join("|");
    params.watch_region = options.watchRegion ?? "MX";
    params.with_watch_monetization_types = options.watchMonetizationTypes ?? "flatrate";
  }
  return params;
};
