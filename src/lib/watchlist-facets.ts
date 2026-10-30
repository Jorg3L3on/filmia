import type { Platform } from "@/db";
import { filterRows, type WatchlistMatchContext, type WatchlistRow } from "@/lib/watchlist-filters";
import { watchlistSearchParams, type WatchlistQuery } from "@/lib/watchlist-query";

/**
 * Facet counts for the Filtros sheet (FIL-I34-4): how many titles a choice would leave, and
 * the live «Ver N». Every count is the real filter run over the rows, so a count and the list
 * it opens can never disagree.
 */

export type WatchlistCounter = (query: WatchlistQuery) => number;

/** Counts memoised by the query's URL (the sheet asks for the same ones on every render). */
export const makeWatchlistCounter = (
  rows: readonly WatchlistRow[],
  context: WatchlistMatchContext,
): WatchlistCounter => {
  const cache = new Map<string, number>();
  return (query) => {
    const key = `${query.scope}|${watchlistSearchParams({ ...query, sort: null, dir: null, seed: null, view: null })}`;
    const hit = cache.get(key);
    if (hit != null) return hit;
    const count = filterRows(rows, query, context).length;
    cache.set(key, count);
    return count;
  };
};

/** Toggle one value of a multi-select (OR) section. */
export const toggleValue = <T>(values: readonly T[], value: T): T[] =>
  values.includes(value) ? values.filter((item) => item !== value) : [...values, value];

/**
 * A multi-select option's count: the titles you would see with only that value picked in its
 * section, everything else as it is. Picked or not, the number means the same thing.
 */
export const optionQuery = <K extends "platforms" | "genres" | "languages" | "people">(
  query: WatchlistQuery,
  key: K,
  value: WatchlistQuery[K][number],
): WatchlistQuery => ({ ...query, [key]: [value] });

/** Platforms with titles, the viewer's own first (badged «TUYA»), then by count. */
export const platformFacet = (
  query: WatchlistQuery,
  count: WatchlistCounter,
  {
    userPlatforms,
    all,
    includeEmpty = false,
  }: { userPlatforms: readonly Platform[]; all: readonly Platform[]; includeEmpty?: boolean },
) =>
  all
    .map((platform) => ({
      platform,
      mine: userPlatforms.includes(platform),
      count: count(optionQuery(query, "platforms", platform)),
    }))
    .filter((entry) => includeEmpty || entry.mine || entry.count > 0 || query.platforms.includes(entry.platform))
    .sort((left, right) => Number(right.mine) - Number(left.mine) || right.count - left.count);

/** Titles the duration filter cannot place (no runtime yet): said out loud, not hidden silently. */
export const missingRuntimeCount = (rows: readonly WatchlistRow[], query: WatchlistQuery, context: WatchlistMatchContext) =>
  filterRows(rows, query, context, "duration").filter((row) => row.runtime == null).length;
