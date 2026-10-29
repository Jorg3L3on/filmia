import type { Platform, SeriesStatus, TitleKind } from "@/db";
import type { CatalogOrderIconName } from "@/lib/catalog-filters";
import { titleMatchesSeriesStatus } from "@/lib/series";
import {
  effectiveDirection,
  type NumberRange,
  type SortDirection,
  type WatchlistFilterKey,
  type WatchlistQuery,
  type WatchlistSort,
} from "@/lib/watchlist-query";

/**
 * Quiero ver (FIL-I34): one light row per title, built on the server, so the client can
 * filter, count and order the whole list without the network (live «Ver N», offline, and
 * reordering with the filters paused). Pure: no React, no database.
 */

export type WatchlistRow = {
  id: string;
  name: string;
  kind: TitleKind;
  seriesStatus: SeriesStatus | null;
  /** Platforms that include it (TMDB flatrate; the saved «Dónde la vi» when never checked). */
  flatrate: Platform[];
  /** Platforms that rent or sell it. */
  rentBuy: Platform[];
  /** Included on one of the viewer's platforms. */
  onMine: boolean;
  /** Never checked against TMDB (and no saved platform): unknown, not «not there». */
  providersUnknown: boolean;
  /** Minutes; per episode for series. */
  runtime: number | null;
  year: number | null;
  imdb: number | null;
  votes: number | null;
  genres: number[];
  awarded: boolean;
  /** Epoch ms. */
  addedAt: number;
  arrivedAt: number | null;
  language: string | null;
  snoozed: boolean;
  hasNote: boolean;
  /** Directors (movies) or creators (series), TMDB ids. */
  people: number[];
};

/** «Cortas»: movies strictly under this many minutes. Series are per-episode, so they never count. */
export const SHORT_RUNTIME_MAX = 100;
/** «Pedir 1 000 votos o más». */
export const VOTES_FLOOR = 1000;

const DAY_MS = 24 * 60 * 60 * 1000;
/** «Agregada»: this week, this month, more than six months ago. */
export const ADDED_WINDOW_MS = { week: 7 * DAY_MS, month: 30 * DAY_MS, old: 182 * DAY_MS } as const;

export const isShortMovie = (row: Pick<WatchlistRow, "kind" | "runtime">) =>
  row.kind === "MOVIE" && row.runtime != null && row.runtime < SHORT_RUNTIME_MAX;

export const inRange = (value: number | null, range: NumberRange) =>
  value != null && (range.min == null || value >= range.min) && (range.max == null || value <= range.max);

export type WatchlistMatchContext = {
  now: number;
};

/** One filter on one row. Platforms follow the sheet's «Suscripción / Alquiler o compra». */
export const rowPasses = (
  row: WatchlistRow,
  query: WatchlistQuery,
  key: WatchlistFilterKey,
  { now }: WatchlistMatchContext,
): boolean => {
  switch (key) {
    case "kind":
      return query.kind === "ALL" || row.kind === query.kind;
    case "seriesStatus":
      return titleMatchesSeriesStatus(row, query.seriesStatus ?? undefined);
    case "platforms": {
      if (query.platforms.length === 0) return true;
      const offers = query.access === "rent" ? row.rentBuy : row.flatrate;
      return offers.some((platform) => query.platforms.includes(platform));
    }
    case "short":
      return !query.short || isShortMovie(row);
    case "duration":
      return !query.duration || inRange(row.runtime, query.duration);
    case "years":
      return !query.years || inRange(row.year, query.years);
    case "imdb":
      return (
        (query.imdbMin == null || (row.imdb != null && row.imdb >= query.imdbMin)) &&
        (!query.votesFloor || (row.votes != null && row.votes >= VOTES_FLOOR))
      );
    case "genres":
      return query.genres.length === 0 || query.genres.some((id) => row.genres.includes(id));
    case "awarded":
      return !query.awarded || row.awarded;
    case "added": {
      if (!query.added) return true;
      const age = now - row.addedAt;
      return query.added === "old" ? age >= ADDED_WINDOW_MS.old : age < ADDED_WINDOW_MS[query.added];
    }
    case "languages":
      return query.languages.length === 0 || (row.language != null && query.languages.includes(row.language));
    case "hideSnoozed":
      return !query.hideSnoozed || !row.snoozed;
    case "withNote":
      return !query.withNote || row.hasNote;
    case "people":
      return query.people.length === 0 || query.people.some((id) => row.people.includes(id));
  }
};

const FILTER_KEYS: readonly WatchlistFilterKey[] = [
  "kind",
  "seriesStatus",
  "platforms",
  "short",
  "duration",
  "years",
  "imdb",
  "genres",
  "awarded",
  "added",
  "languages",
  "hideSnoozed",
  "withNote",
  "people",
];

/** Scope «Mis plataformas»: included on one of the viewer's platforms. */
export const rowInScope = (row: WatchlistRow, query: Pick<WatchlistQuery, "scope">) =>
  query.scope === "all" || row.onMine;

/**
 * Whether a row passes the scope and every filter; `except` skips one filter (facet counts,
 * the empty state's exits). AND between filters, OR inside genres, platforms, languages, people.
 */
export const rowMatches = (
  row: WatchlistRow,
  query: WatchlistQuery,
  context: WatchlistMatchContext,
  except?: WatchlistFilterKey | "scope",
) =>
  (except === "scope" || rowInScope(row, query)) &&
  FILTER_KEYS.every((key) => key === except || rowPasses(row, query, key, context));

export const filterRows = (
  rows: readonly WatchlistRow[],
  query: WatchlistQuery,
  context: WatchlistMatchContext,
  except?: WatchlistFilterKey | "scope",
) => rows.filter((row) => rowMatches(row, query, context, except));

/** The two scope cells: whole-list totals, not the filtered counts (those are «N de total»). */
export const scopeCounts = (rows: readonly WatchlistRow[]) => ({
  all: rows.length,
  mine: rows.filter((row) => row.onMine).length,
});

/** Mulberry32: a small seeded PRNG, so a shuffle is stable for its seed. */
const seededRandom = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** Fisher–Yates with a seed: same seed, same order. */
export const shuffleWithSeed = <T>(items: readonly T[], seed: number): T[] => {
  const copy = [...items];
  const random = seededRandom(seed);
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap] as T, copy[index] as T];
  }
  return copy;
};

const byName = (left: WatchlistRow, right: WatchlistRow) => left.name.localeCompare(right.name, "es");

/** Nulls always sink to the end, whatever the direction. */
const compareNullable = (left: number | null, right: number | null, direction: SortDirection) => {
  if (left == null && right == null) return 0;
  if (left == null) return 1;
  if (right == null) return -1;
  return direction === "asc" ? left - right : right - left;
};

/**
 * Rows in the chosen order. `null` keeps the manual order (the input order). Ties fall back to
 * the Spanish title order; «Mejor valoradas» ranks titles with 1 000+ votes before the rest;
 * «Disponibles ahora» keeps the manual order inside each group.
 */
export const sortRows = (
  rows: readonly WatchlistRow[],
  query: Pick<WatchlistQuery, "sort" | "dir" | "seed">,
): WatchlistRow[] => {
  const { sort } = query;
  if (!sort) return [...rows];
  if (sort === "random") return shuffleWithSeed(rows, query.seed ?? 0);
  if (sort === "available") {
    return [...rows.filter((row) => row.onMine), ...rows.filter((row) => !row.onMine)];
  }

  const direction = effectiveDirection(query) ?? "desc";
  const keyOf = (row: WatchlistRow): number | null => {
    switch (sort) {
      case "added":
        return row.addedAt;
      case "imdb":
        return row.imdb;
      case "runtime":
        return row.runtime;
      case "year":
        return row.year;
      case "arrived":
        return row.arrivedAt;
    }
  };
  const tier = (row: WatchlistRow) => (sort === "imdb" && (row.votes ?? 0) < VOTES_FLOOR ? 1 : 0);

  return [...rows].sort(
    (left, right) =>
      tier(left) - tier(right) ||
      compareNullable(keyOf(left), keyOf(right), direction) ||
      byName(left, right),
  );
};

export type WatchlistSortOption = {
  /** `null` = the manual order (Mi orden). */
  id: WatchlistSort | null;
  label: string;
  hint: string;
  icon: CatalogOrderIconName;
};

/** The Ordenar sheet, in its order (FIL-I34-3). */
export const WATCHLIST_SORT_OPTIONS: readonly WatchlistSortOption[] = [
  { id: null, label: "Mi orden", hint: "Como la armaste", icon: "queue" },
  { id: "added", label: "Agregadas hace poco", hint: "Las últimas en entrar", icon: "clock" },
  { id: "imdb", label: "Mejor valoradas", hint: "Nota IMDb, con 1 000 votos o más", icon: "star" },
  { id: "runtime", label: "Más cortas primero", hint: "Por duración", icon: "hourglass" },
  { id: "year", label: "Estreno", hint: "Año de la película", icon: "calendar" },
  { id: "available", label: "Disponibles ahora", hint: "Primero lo que ya tienes en tus plataformas", icon: "eye" },
  { id: "arrived", label: "Acaba de llegar", hint: "A tus plataformas", icon: "sparkle" },
  { id: "random", label: "Aleatoria", hint: "Sorpréndeme: barajar tu lista", icon: "dice" },
];

/** Direction words per sort: what «↑» (asc) and «↓» (desc) mean there. */
export const SORT_DIRECTION_LABEL: Partial<Record<WatchlistSort, Record<SortDirection, string>>> = {
  added: { desc: "Recientes primero", asc: "Antiguas primero" },
  imdb: { desc: "Mejor nota primero", asc: "Peor nota primero" },
  runtime: { asc: "Más cortas primero", desc: "Más largas primero" },
  year: { desc: "Más nuevas primero", asc: "Más antiguas primero" },
  arrived: { desc: "Lo más reciente primero", asc: "Lo que lleva más tiempo" },
};

/** The order pill's short name. */
export const sortPillLabel = (query: Pick<WatchlistQuery, "sort" | "dir">) => {
  switch (query.sort) {
    case null:
      return "Mi orden";
    case "added":
      return "Agregadas";
    case "imdb":
      return "Mejor valoradas";
    case "runtime":
      return effectiveDirection(query) === "desc" ? "Más largas" : "Más cortas";
    case "year":
      return "Estreno";
    case "available":
      return "Disponibles ahora";
    case "arrived":
      return "Acaba de llegar";
    case "random":
      return "Aleatoria";
  }
};

/** VoiceOver: «de menor a mayor» / «de mayor a menor». */
export const directionSpoken = (direction: SortDirection) =>
  direction === "asc" ? "de menor a mayor" : "de mayor a menor";

export type WatchlistGenreCount = { id: number; name: string; count: number };
