import type { TitleKind } from "@/db";
import { awardChipLabel } from "@/lib/awards";
import { parseStoredTmdbGenres } from "@/lib/diary-picks";
import { parseMinePlatforms } from "@/lib/tags";

/**
 * Quiero ver «La cartelera»: rail chips (Esta noche · Cortas · Premiadas · Género)
 * and the sort sheet. Pure; the page parses the URL and the client applies
 * «Esta noche» (it needs the viewer's clock).
 */

export type WatchlistSort = "arrived" | "imdb" | "runtime" | "year" | "added";

export const WATCHLIST_SORTS: readonly WatchlistSort[] = [
  "arrived",
  "imdb",
  "runtime",
  "year",
  "added",
];

export type WatchlistSortIcon = "queue" | "sparkle" | "star" | "hourglass" | "calendar" | "clock";

export type WatchlistSortOption = {
  /** `null` = the manual order (Mi orden). */
  id: WatchlistSort | null;
  label: string;
  hint: string;
  icon: WatchlistSortIcon;
};

export const WATCHLIST_SORT_OPTIONS: readonly WatchlistSortOption[] = [
  { id: null, label: "Mi orden", hint: "como la armaste", icon: "queue" },
  { id: "arrived", label: "Acaba de llegar", hint: "a mis plataformas", icon: "sparkle" },
  { id: "imdb", label: "Nota IMDb", hint: "mejor primero", icon: "star" },
  { id: "runtime", label: "Más cortas primero", hint: "por duración", icon: "hourglass" },
  { id: "year", label: "Año", hint: "clásicos primero", icon: "calendar" },
  { id: "added", label: "Recién agregadas", hint: "últimas en entrar", icon: "clock" },
];

/** «Cortas»: movies strictly under this many minutes. Series are per-episode, so they never count. */
export const SHORT_RUNTIME_MAX = 100;

const lastString = (value: unknown): string => {
  if (Array.isArray(value)) {
    return lastString(value.at(-1));
  }
  return typeof value === "string" ? value.trim() : "";
};

export const parseWatchlistSort = (value: unknown): WatchlistSort | null => {
  const raw = lastString(value);
  return (WATCHLIST_SORTS as readonly string[]).includes(raw) ? (raw as WatchlistSort) : null;
};

/** Same semantics as `?minePlatforms=`: "1", "true" or "on". */
export const parseFlag = (value: unknown): boolean => parseMinePlatforms(value);

/** `?genre=18&genre=878` or `?genre=18,878` → unique positive ints, in order. */
export const parseGenreIds = (value: unknown): number[] => {
  const raw = Array.isArray(value) ? value : value == null ? [] : [value];
  const ids: number[] = [];
  for (const item of raw) {
    if (typeof item !== "string") {
      continue;
    }
    for (const piece of item.split(",")) {
      const id = Number(piece.trim());
      if (Number.isInteger(id) && id > 0 && !ids.includes(id)) {
        ids.push(id);
      }
    }
  }
  return ids;
};

export type WatchlistFilterTitle = {
  id: string;
  name: string;
  kind: TitleKind;
  year: number | null;
  runtimeMinutes: number | null;
  imdbRating: number | null;
  availableSince: Date | string | null;
  awards?: string | null;
  tmdbGenres: unknown;
};

export type WatchlistFilterItem = {
  addedAt: Date | string;
  title: WatchlistFilterTitle;
};

export const isShortMovie = (title: Pick<WatchlistFilterTitle, "kind" | "runtimeMinutes">) =>
  title.kind === "MOVIE" && title.runtimeMinutes != null && title.runtimeMinutes < SHORT_RUNTIME_MAX;

export const isAwarded = (title: Pick<WatchlistFilterTitle, "awards">) =>
  awardChipLabel(title.awards) != null;

const genreIdsOf = (title: Pick<WatchlistFilterTitle, "tmdbGenres">) =>
  parseStoredTmdbGenres(title.tmdbGenres).map((genre) => genre.id);

export type WatchlistFilters = {
  short?: boolean;
  awarded?: boolean;
  genreIds?: readonly number[];
};

export const applyWatchlistFilters = <T extends WatchlistFilterItem>(
  items: readonly T[],
  { short = false, awarded = false, genreIds = [] }: WatchlistFilters,
): T[] =>
  items.filter((item) => {
    if (short && !isShortMovie(item.title)) {
      return false;
    }
    if (awarded && !isAwarded(item.title)) {
      return false;
    }
    if (genreIds.length > 0) {
      const own = genreIdsOf(item.title);
      if (!genreIds.some((id) => own.includes(id))) {
        return false;
      }
    }
    return true;
  });

const time = (value: Date | string | null | undefined) =>
  value ? new Date(value).getTime() : null;

const byName = (left: WatchlistFilterTitle, right: WatchlistFilterTitle) =>
  left.name.localeCompare(right.name, "es");

/** Nulls always sink to the end; ties fall back to the Spanish title order. */
const compareNullable = (
  left: number | null,
  right: number | null,
  direction: "asc" | "desc",
) => {
  if (left == null && right == null) return 0;
  if (left == null) return 1;
  if (right == null) return -1;
  return direction === "asc" ? left - right : right - left;
};

export const sortWatchlistItems = <T extends WatchlistFilterItem>(
  items: readonly T[],
  sort: WatchlistSort | null,
): T[] => {
  const copy = [...items];
  if (!sort) {
    return copy;
  }

  const keyOf = (item: T): number | null => {
    switch (sort) {
      case "arrived":
        return time(item.title.availableSince);
      case "imdb":
        return item.title.imdbRating;
      case "runtime":
        return item.title.runtimeMinutes;
      case "year":
        return item.title.year;
      case "added":
        return time(item.addedAt);
    }
  };
  const direction = sort === "runtime" || sort === "year" ? "asc" : "desc";

  return copy.sort((left, right) => {
    const delta = compareNullable(keyOf(left), keyOf(right), direction);
    return delta !== 0 ? delta : byName(left.title, right.title);
  });
};

export type WatchlistGenreCount = { id: number; name: string; count: number };

/** Genres present in the (unfiltered) list, most common first. */
export const genresInList = (
  items: readonly { title: Pick<WatchlistFilterTitle, "tmdbGenres"> }[],
): WatchlistGenreCount[] => {
  const counts = new Map<number, WatchlistGenreCount>();
  for (const item of items) {
    for (const genre of parseStoredTmdbGenres(item.title.tmdbGenres)) {
      const entry = counts.get(genre.id) ?? { id: genre.id, name: genre.name, count: 0 };
      entry.count += 1;
      counts.set(genre.id, entry);
    }
  }
  return [...counts.values()].sort(
    (left, right) => right.count - left.count || left.name.localeCompare(right.name, "es"),
  );
};
