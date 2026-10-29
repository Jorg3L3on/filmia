import type { Platform } from "@/db";
import { parseKindFilter, parsePlatformFilters } from "@/lib/catalog-filters";
import { MINE_PLATFORMS_PARAM, parseMinePlatforms, type CatalogKindFilter } from "@/lib/catalog-href";
import { PLATFORMS } from "@/lib/labels";
import { parseSeriesStatusFilter, type SeriesStatusFilter } from "@/lib/series";

/**
 * Quiero ver «Barra de decisión» (FIL-I34): everything the header and the sheets can set,
 * and its URL. Params stay short; old links keep working (`?minePlatforms=1` is the
 * «Mis plataformas» scope, `?sort=year` is Estreno). `?tonight=1` («Esta noche», removed in
 * FIL-I34-1) is ignored: the list shows Todo.
 *
 * | param      | meaning                                             |
 * |------------|-----------------------------------------------------|
 * | minePlatforms=1 | scope «Mis plataformas» (default Todo)          |
 * | sort, dir  | order and its direction (dir only when not default) |
 * | seed       | Aleatoria / Sorpréndeme shuffle seed                |
 * | kind, seriesStatus | Tipo and series status                      |
 * | platform, access=rent | Dónde verla (default suscripción)        |
 * | short=1    | Cortas: movies under 100 min                        |
 * | dur=lo-hi  | duration range in minutes (open ends allowed)       |
 * | year=lo-hi | year range                                          |
 * | imdb=7, votes=1 | minimum IMDb rating, 1 000 votes or more       |
 * | genre      | TMDB genre ids (OR)                                 |
 * | awarded=1, added=week·month·old, lang | Premiadas, Agregada, idioma |
 * | nosnooze=1, note=1 | hide «Ahora no», only with my note          |
 * | person     | director or creator TMDB ids (OR)                   |
 */

export type WatchlistScope = "all" | "mine";

export type WatchlistSort = "added" | "imdb" | "runtime" | "year" | "available" | "arrived" | "random";

export type SortDirection = "asc" | "desc";

export type WatchlistAccess = "flatrate" | "rent";

export type WatchlistAdded = "week" | "month" | "old";

/** Inclusive; `null` is an open end. */
export type NumberRange = { min: number | null; max: number | null };

export type WatchlistQuery = {
  scope: WatchlistScope;
  sort: WatchlistSort | null;
  /** `null` = the sort's default direction. */
  dir: SortDirection | null;
  seed: number | null;
  kind: CatalogKindFilter;
  seriesStatus: SeriesStatusFilter | null;
  platforms: Platform[];
  access: WatchlistAccess;
  short: boolean;
  duration: NumberRange | null;
  years: NumberRange | null;
  imdbMin: number | null;
  votesFloor: boolean;
  genres: number[];
  awarded: boolean;
  added: WatchlistAdded | null;
  languages: string[];
  hideSnoozed: boolean;
  withNote: boolean;
  people: number[];
};

export const EMPTY_WATCHLIST_QUERY: WatchlistQuery = {
  scope: "all",
  sort: null,
  dir: null,
  seed: null,
  kind: "ALL",
  seriesStatus: null,
  platforms: [],
  access: "flatrate",
  short: false,
  duration: null,
  years: null,
  imdbMin: null,
  votesFloor: false,
  genres: [],
  awarded: false,
  added: null,
  languages: [],
  hideSnoozed: false,
  withNote: false,
  people: [],
};

export const WATCHLIST_SORTS: readonly WatchlistSort[] = [
  "added",
  "imdb",
  "runtime",
  "year",
  "available",
  "arrived",
  "random",
];

/** Default direction per sort; `null` = the sort has no direction (no arrow). */
export const SORT_DEFAULT_DIRECTION: Record<WatchlistSort, SortDirection | null> = {
  added: "desc",
  imdb: "desc",
  runtime: "asc",
  year: "desc",
  available: null,
  arrived: "desc",
  random: null,
};

export const IMDB_MIN_OPTIONS = [6, 7, 8] as const;
export const ADDED_OPTIONS: readonly WatchlistAdded[] = ["week", "month", "old"];

type RawParams = Record<string, string | string[] | undefined>;

const all = (value: unknown): string[] =>
  (Array.isArray(value) ? value : value == null ? [] : [value]).filter(
    (item): item is string => typeof item === "string",
  );

const last = (value: unknown) => all(value).at(-1)?.trim() ?? "";

const flag = (value: unknown) => parseMinePlatforms(value);

const positiveInts = (value: unknown): number[] => {
  const ids: number[] = [];
  for (const item of all(value)) {
    for (const piece of item.split(",")) {
      const id = Number(piece.trim());
      if (Number.isInteger(id) && id > 0 && !ids.includes(id)) {
        ids.push(id);
      }
    }
  }
  return ids;
};

/** `?genre=18&genre=878` or `?genre=18,878` → unique positive ints, in order. */
export const parseGenreIds = positiveInts;

export const parseWatchlistSort = (value: unknown): WatchlistSort | null => {
  const raw = last(value);
  return (WATCHLIST_SORTS as readonly string[]).includes(raw) ? (raw as WatchlistSort) : null;
};

const parseInteger = (raw: string): number | null => {
  if (raw === "") return null;
  const value = Number(raw);
  return Number.isInteger(value) && value >= 0 ? value : null;
};

/** `100-150`, `-99`, `150-` → a range; anything else (or `-`) → null. */
export const parseRange = (value: unknown): NumberRange | null => {
  const match = /^(\d*)-(\d*)$/.exec(last(value));
  if (!match) return null;
  let min = parseInteger(match[1] ?? "");
  let max = parseInteger(match[2] ?? "");
  if (min == null && max == null) return null;
  if (min != null && max != null && min > max) [min, max] = [max, min];
  return { min, max };
};

export const formatRange = (range: NumberRange) => `${range.min ?? ""}-${range.max ?? ""}`;

const LANGUAGE_CODE = /^[a-z]{2,3}$/;

export const parseWatchlistQuery = (params: RawParams): WatchlistQuery => {
  const sort = parseWatchlistSort(params.sort);
  const rawDir = last(params.dir);
  const dir = rawDir === "asc" || rawDir === "desc" ? rawDir : null;
  const seed = sort === "random" ? parseInteger(last(params.seed)) : null;
  const imdbMin = Number(last(params.imdb));
  const added = last(params.added);
  return {
    scope: flag(params[MINE_PLATFORMS_PARAM]) ? "mine" : "all",
    sort,
    dir: sort && SORT_DEFAULT_DIRECTION[sort] && dir !== SORT_DEFAULT_DIRECTION[sort] ? dir : null,
    seed,
    kind: parseKindFilter(params.kind),
    seriesStatus: parseSeriesStatusFilter(params.seriesStatus) ?? null,
    platforms: parsePlatformFilters(params.platform),
    access: last(params.access) === "rent" ? "rent" : "flatrate",
    short: flag(params.short),
    duration: parseRange(params.dur),
    years: parseRange(params.year),
    imdbMin: (IMDB_MIN_OPTIONS as readonly number[]).includes(imdbMin) ? imdbMin : null,
    votesFloor: flag(params.votes),
    genres: positiveInts(params.genre),
    awarded: flag(params.awarded),
    added: (ADDED_OPTIONS as readonly string[]).includes(added) ? (added as WatchlistAdded) : null,
    languages: [...new Set(all(params.lang).map((code) => code.trim().toLowerCase()))].filter((code) =>
      LANGUAGE_CODE.test(code),
    ),
    hideSnoozed: flag(params.nosnooze),
    withNote: flag(params.note),
    people: positiveInts(params.person),
  };
};

/** The sort's direction as applied (explicit or default); `null` when it has none. */
export const effectiveDirection = (query: Pick<WatchlistQuery, "sort" | "dir">): SortDirection | null =>
  query.sort ? (SORT_DEFAULT_DIRECTION[query.sort] ? (query.dir ?? SORT_DEFAULT_DIRECTION[query.sort]) : null) : null;

export const watchlistSearchParams = (query: WatchlistQuery) => {
  const params = new URLSearchParams();
  if (query.scope === "mine") params.set(MINE_PLATFORMS_PARAM, "1");
  if (query.sort) {
    params.set("sort", query.sort);
    const fallback = SORT_DEFAULT_DIRECTION[query.sort];
    if (fallback && query.dir && query.dir !== fallback) params.set("dir", query.dir);
    if (query.sort === "random" && query.seed != null) params.set("seed", String(query.seed));
  }
  if (query.kind !== "ALL") params.set("kind", query.kind);
  if (query.seriesStatus) params.set("seriesStatus", query.seriesStatus);
  for (const platform of PLATFORMS.filter((item) => query.platforms.includes(item))) {
    params.append("platform", platform);
  }
  if (query.access === "rent") params.set("access", "rent");
  if (query.short) params.set("short", "1");
  if (query.duration) params.set("dur", formatRange(query.duration));
  if (query.years) params.set("year", formatRange(query.years));
  if (query.imdbMin != null) params.set("imdb", String(query.imdbMin));
  if (query.votesFloor) params.set("votes", "1");
  for (const id of query.genres) params.append("genre", String(id));
  if (query.awarded) params.set("awarded", "1");
  if (query.added) params.set("added", query.added);
  for (const code of query.languages) params.append("lang", code);
  if (query.hideSnoozed) params.set("nosnooze", "1");
  if (query.withNote) params.set("note", "1");
  for (const id of query.people) params.append("person", String(id));
  return params;
};

export const watchlistHref = (pathname: string, query: WatchlistQuery) => {
  const qs = watchlistSearchParams(query).toString();
  return qs ? `${pathname}?${qs}` : pathname;
};

/**
 * The filters a person can remove one by one: the chips with ×, the funnel's badge, the
 * empty state's exits. Scope and order are not filters (they show in their own controls).
 */
export type WatchlistFilterKey =
  | "kind"
  | "seriesStatus"
  | "platforms"
  | "short"
  | "duration"
  | "years"
  | "imdb"
  | "genres"
  | "awarded"
  | "added"
  | "languages"
  | "hideSnoozed"
  | "withNote"
  | "people";

export const WATCHLIST_FILTER_KEYS: readonly WatchlistFilterKey[] = [
  "short",
  "genres",
  "kind",
  "seriesStatus",
  "platforms",
  "duration",
  "years",
  "imdb",
  "awarded",
  "added",
  "languages",
  "hideSnoozed",
  "withNote",
  "people",
];

export const isFilterActive = (query: WatchlistQuery, key: WatchlistFilterKey): boolean => {
  switch (key) {
    case "kind":
      return query.kind !== "ALL";
    case "seriesStatus":
      return query.seriesStatus != null;
    case "platforms":
      return query.platforms.length > 0;
    case "short":
      return query.short;
    case "duration":
      return query.duration != null;
    case "years":
      return query.years != null;
    case "imdb":
      return query.imdbMin != null || query.votesFloor;
    case "genres":
      return query.genres.length > 0;
    case "awarded":
      return query.awarded;
    case "added":
      return query.added != null;
    case "languages":
      return query.languages.length > 0;
    case "hideSnoozed":
      return query.hideSnoozed;
    case "withNote":
      return query.withNote;
    case "people":
      return query.people.length > 0;
  }
};

export const withoutFilter = (query: WatchlistQuery, key: WatchlistFilterKey): WatchlistQuery => {
  switch (key) {
    case "kind":
      return { ...query, kind: "ALL", seriesStatus: query.kind === "SERIES" ? null : query.seriesStatus };
    case "seriesStatus":
      return { ...query, seriesStatus: null };
    case "platforms":
      return { ...query, platforms: [], access: "flatrate" };
    case "short":
      return { ...query, short: false };
    case "duration":
      return { ...query, duration: null };
    case "years":
      return { ...query, years: null };
    case "imdb":
      return { ...query, imdbMin: null, votesFloor: false };
    case "genres":
      return { ...query, genres: [] };
    case "awarded":
      return { ...query, awarded: false };
    case "added":
      return { ...query, added: null };
    case "languages":
      return { ...query, languages: [] };
    case "hideSnoozed":
      return { ...query, hideSnoozed: false };
    case "withNote":
      return { ...query, withNote: false };
    case "people":
      return { ...query, people: [] };
  }
};

export const activeFilterKeys = (query: WatchlistQuery) =>
  WATCHLIST_FILTER_KEYS.filter((key) => isFilterActive(query, key));

/** The funnel's badge: the sheet's filters and the shortcuts, not the scope or the order. */
export const activeFilterCount = (query: WatchlistQuery) => activeFilterKeys(query).length;

/** «Limpiar filtros»: everything back to Todo, keeping the order. */
export const clearFilters = (query: WatchlistQuery): WatchlistQuery => ({
  ...EMPTY_WATCHLIST_QUERY,
  sort: query.sort,
  dir: query.dir,
  seed: query.seed,
});

export const isNarrowed = (query: WatchlistQuery) => query.scope === "mine" || activeFilterCount(query) > 0;

