import { filterChipLabel, type WatchlistChipNames } from "@/lib/watchlist-chips";
import type { WatchlistCounter } from "@/lib/watchlist-facets";
import {
  activeFilterKeys,
  clearFilters,
  effectiveDirection,
  withoutFilter,
  type WatchlistFilterKey,
  type WatchlistQuery,
} from "@/lib/watchlist-query";

/**
 * Quiero ver, pure helpers for the page's words: the hero's eyebrow under an order
 * (FIL-I24-4, FIL-I34-3) and the 0-results exits (FIL-I34-5).
 */

/** «Próxima en tu lista» in Mi orden; with an order, what the first row is. */
export const heroEyebrow = (
  query: Pick<WatchlistQuery, "sort" | "dir">,
  platformLabel?: string | null,
) => {
  const asc = effectiveDirection(query) === "asc";
  switch (query.sort) {
    case null:
      return "Próxima en tu lista";
    case "imdb":
      return asc ? "La nota más baja de tu lista" : "Mejor nota de tu lista";
    case "runtime":
      return asc ? "La más corta" : "La más larga";
    case "year":
      return asc ? "La más antigua" : "La más nueva";
    case "arrived":
      if (asc) return "La que lleva más tiempo disponible";
      return platformLabel ? `Acaba de llegar a ${platformLabel}` : "Acaba de llegar";
    case "added":
      return asc ? "La primera que agregaste" : "La última en entrar";
    case "available":
      return platformLabel ? `Ya está en ${platformLabel}` : "Disponible ahora";
    case "random":
      return "Sorpréndeme: esta";
  }
};

/** «#3 en tu orden» for the rows while an order replaces the manual ranks. */
export const sortedRankLabel = (rank: number) => `#${rank} en tu orden`;

export type WatchlistExit = {
  key: WatchlistFilterKey | "scope" | "all";
  /** «Quitar «Documental»», «Ver Todo», «Limpiar todo». */
  label: string;
  count: number;
  query: WatchlistQuery;
  /** The exit that brings back the most titles (drawn highlighted). */
  best: boolean;
};

export type WatchlistEmptyCopy = {
  title: string;
  description: string;
};

/**
 * The 0-results state: one exit per active filter (and the scope) with how many titles it
 * brings back, the best one first, then «Limpiar todo» when there is more than one. Exits that
 * would still show nothing are left out (with many filters they are most of them).
 */
export const watchlistExits = (
  query: WatchlistQuery,
  count: WatchlistCounter,
  names: WatchlistChipNames,
): WatchlistExit[] => {
  const exits: Omit<WatchlistExit, "best">[] = activeFilterKeys(query).map((key) => {
    const next = withoutFilter(query, key);
    return { key, label: `Quitar «${filterChipLabel(query, key, names)}»`, count: count(next), query: next };
  });
  if (query.scope === "mine") {
    const next: WatchlistQuery = { ...query, scope: "all" };
    exits.push({ key: "scope", label: "Ver Todo, no solo mis plataformas", count: count(next), query: next });
  }
  exits.sort((left, right) => right.count - left.count);
  const ranked = exits.filter((exit) => exit.count > 0).map((exit, index) => ({ ...exit, best: index === 0 }));
  if (exits.length > 1) {
    const next = clearFilters(query);
    ranked.push({ key: "all", label: "Limpiar todo", count: count(next), query: next, best: false });
  }
  return ranked;
};

const COUNT_WORDS = ["", "esa cosa", "las dos cosas", "las tres cosas", "las cuatro cosas", "las cinco cosas"];

/** «Nada con esa mezcla» / «Nada con «Documental»» / «Nada en tus plataformas». */
export const watchlistEmptyCopy = (
  query: WatchlistQuery,
  total: number,
  names: WatchlistChipNames,
): WatchlistEmptyCopy => {
  const keys = activeFilterKeys(query);
  const of = `Ninguna de tus ${total}`;
  if (keys.length === 0 && query.scope === "mine") {
    return {
      title: "Nada en tus plataformas",
      description: `${of} está incluida en tus plataformas. Este filtro no cuenta renta ni compra.`,
    };
  }
  const only = keys.length === 1 && query.scope === "all" ? keys[0] : undefined;
  if (only) {
    const chip = filterChipLabel(query, only, names);
    return { title: `Nada con «${chip}»`, description: `${of} cumple con «${chip}».` };
  }
  const things = keys.length + (query.scope === "mine" ? 1 : 0);
  return {
    title: "Nada con esa mezcla",
    description: `${of} cumple ${COUNT_WORDS[things] ?? "todo"} a la vez. Quita una y mira cuántas aparecen.`,
  };
};
