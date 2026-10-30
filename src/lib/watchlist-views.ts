import { filterChipLabel, type WatchlistChipNames } from "@/lib/watchlist-chips";
import { sortPillLabel } from "@/lib/watchlist-filters";
import {
  activeFilterKeys,
  EMPTY_WATCHLIST_QUERY,
  effectiveDirection,
  parseWatchlistQuery,
  watchlistSearchParams,
  type WatchlistQuery,
} from "@/lib/watchlist-query";

/**
 * Quiero ver · vistas guardadas (FIL-I34-6). A view is a name plus the canonical URL query of
 * a scope, its filters and its order — never the shuffle seed or the view id itself, so two
 * views that show the same thing store the same string. Pure: shared by the server actions,
 * the store and the header.
 */

export type SavedView = {
  id: string;
  name: string;
  query: string;
  pinned: boolean;
};

/** What every write answers: the whole (short) list, so the header never refetches. */
export type SavedViewsResult = { ok: true; views: SavedView[]; id?: string } | { ok: false; error: string };

export const MAX_SAVED_VIEWS = 20;
export const VIEW_NAME_MAX = 40;

/** The string stored in `SavedView.query`. */
export const viewQueryString = (query: WatchlistQuery) =>
  watchlistSearchParams({ ...query, seed: null, view: null }).toString();

export const parseViewQuery = (stored: string): WatchlistQuery => {
  const params = new URLSearchParams(stored);
  const raw: Record<string, string[]> = {};
  for (const key of new Set(params.keys())) raw[key] = params.getAll(key);
  return { ...parseWatchlistQuery(raw), seed: null, view: null };
};

/** Server side: whatever the client sent, keep only what Quiero ver understands. */
export const normalizeViewQuery = (stored: string) => viewQueryString(parseViewQuery(stored));

/** A view that would show exactly the whole list in Mi orden is not worth saving. */
export const isSavableQuery = (query: WatchlistQuery) => viewQueryString(query) !== "";

/** Trimmed, single-spaced, at most 40 characters; `null` when nothing is left. */
export const cleanViewName = (name: string): string | null => {
  const clean = name.replace(/\s+/g, " ").trim().slice(0, VIEW_NAME_MAX).trim();
  return clean === "" ? null : clean;
};

/** The query the person sees is still the view's own (the seed of Aleatoria aside). */
export const matchesView = (query: WatchlistQuery, view: Pick<SavedView, "query">) =>
  viewQueryString(query) === view.query;

/** Opening a view: its query, tagged with its id (the caller adds a seed for Aleatoria). */
export const openView = (view: Pick<SavedView, "id" | "query">): WatchlistQuery => ({
  ...parseViewQuery(view.query),
  view: view.id,
});

/** The view the person came from, while the URL still names it. */
export const activeView = (query: WatchlistQuery, views: readonly SavedView[]) =>
  query.view ? (views.find((view) => view.id === query.view) ?? null) : null;

/** «Antes de 1990 · Nota 7+ · Estreno ↑»: scope, filters, then the order when not Mi orden. */
export const viewSummary = (query: WatchlistQuery, names: WatchlistChipNames) => {
  const parts: string[] = [];
  if (query.scope === "mine") parts.push("Mis plataformas");
  for (const key of activeFilterKeys(query)) parts.push(filterChipLabel(query, key, names));
  if (query.sort) {
    const direction = effectiveDirection(query);
    parts.push(`${sortPillLabel(query)}${direction ? (direction === "asc" ? " ↑" : " ↓") : ""}`);
  }
  return parts.length > 0 ? parts.join(" · ") : "Toda la lista";
};

/** Leaving a view from the scope bar: that scope, nothing else. */
export const scopeOnly = (scope: WatchlistQuery["scope"]): WatchlistQuery => ({ ...EMPTY_WATCHLIST_QUERY, scope });
