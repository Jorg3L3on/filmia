import { catalogHref, type CatalogQuery } from "@/lib/catalog-href";
import type { WatchlistSort } from "@/lib/watchlist-filters";

/**
 * Quiero ver, pure helpers for the page's words (FIL-I24-4): the hero's eyebrow under a
 * sort, and the one empty state that names the chip responsible.
 */

/** «Próxima en tu lista» only without a sort; with one, what the first row is. */
export const heroEyebrow = (sort: WatchlistSort | null, platformLabel?: string | null) => {
  switch (sort) {
    case null:
      return "Próxima en tu lista";
    case "imdb":
      return "Mejor nota de tu lista";
    case "runtime":
      return "La más corta";
    case "year":
      return "La más antigua";
    case "arrived":
      return platformLabel ? `Acaba de llegar a ${platformLabel}` : "Acaba de llegar";
    case "added":
      return "La última en entrar";
  }
};

/** «#3 en tu orden» for the rows while a sort replaces the manual ranks. */
export const sortedRankLabel = (rank: number) => `#${rank} en tu orden`;

export type WatchlistEmptyCulprit =
  | "tonight"
  | "minePlatforms"
  | "platforms"
  | "short"
  | "awarded"
  | "genres"
  | "kind"
  | "seriesStatus";

export type WatchlistEmptyState = {
  culprit: WatchlistEmptyCulprit;
  /** The chip's name, as the user reads it. */
  chip: string;
  /** Href with that one parameter removed. */
  clearHref: string;
};

const CHIP_NAME: Record<Exclude<WatchlistEmptyCulprit, "genres" | "platforms">, string> = {
  tonight: "Esta noche",
  minePlatforms: "Mis plataformas",
  short: "Cortas",
  awarded: "Premiadas",
  kind: "Tipo",
  seriesStatus: "Estado de la serie",
};

/** First active chip in this order gets the blame: what the user touched last is usually the narrowest. */
const CULPRIT_ORDER: WatchlistEmptyCulprit[] = [
  "tonight",
  "minePlatforms",
  "platforms",
  "short",
  "awarded",
  "genres",
  "kind",
  "seriesStatus",
];

const isActive = (query: CatalogQuery, culprit: WatchlistEmptyCulprit) => {
  switch (culprit) {
    case "tonight":
      return Boolean(query.tonight);
    case "minePlatforms":
      return Boolean(query.minePlatforms);
    case "platforms":
      return (query.platforms?.length ?? 0) > 0;
    case "short":
      return Boolean(query.short);
    case "awarded":
      return Boolean(query.awarded);
    case "genres":
      return (query.genres?.length ?? 0) > 0;
    case "kind":
      return Boolean(query.kind) && query.kind !== "ALL";
    case "seriesStatus":
      return Boolean(query.seriesStatus);
  }
};

const without = (query: CatalogQuery, culprit: WatchlistEmptyCulprit): CatalogQuery => {
  switch (culprit) {
    case "tonight":
      return { ...query, tonight: false };
    case "minePlatforms":
      return { ...query, minePlatforms: false };
    case "platforms":
      return { ...query, platforms: [] };
    case "short":
      return { ...query, short: false };
    case "awarded":
      return { ...query, awarded: false };
    case "genres":
      return { ...query, genres: [] };
    case "kind":
      return { ...query, kind: "ALL" };
    case "seriesStatus":
      return { ...query, seriesStatus: null };
  }
};

/**
 * Which chip empties the list, and the href that removes it. `null` when nothing is active
 * (the list itself is empty). `genreName` names a single selected genre; `platformsLabel` the
 * picked platforms («Netflix y Max»).
 */
export const watchlistEmptyState = (
  pathname: string,
  query: CatalogQuery,
  { genreName, platformsLabel }: { genreName?: string | null; platformsLabel?: string | null } = {},
): WatchlistEmptyState | null => {
  const culprit = CULPRIT_ORDER.find((candidate) => isActive(query, candidate));
  if (!culprit) {
    return null;
  }
  const chip =
    culprit === "genres"
      ? (query.genres?.length ?? 0) === 1 && genreName
        ? genreName
        : "Género"
      : culprit === "platforms"
        ? platformsLabel || "Plataforma"
        : CHIP_NAME[culprit];
  return { culprit, chip, clearHref: catalogHref(pathname, without(query, culprit)) };
};
