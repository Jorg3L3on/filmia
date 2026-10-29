"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import { parseWatchlistQuery, watchlistHref, type WatchlistQuery } from "@/lib/watchlist-query";

const SEED_KEY = "filmia:qv-seed";

const freshSeed = () => Math.floor(Math.random() * 2 ** 31);

/** Sorpréndeme's seed for this session: the same shuffle until «Barajar otra vez». */
export const sessionSeed = (reshuffle = false) => {
  try {
    const stored = Number(window.sessionStorage.getItem(SEED_KEY));
    if (!reshuffle && Number.isInteger(stored) && stored > 0) return stored;
    const seed = freshSeed() || 1;
    window.sessionStorage.setItem(SEED_KEY, String(seed));
    return seed;
  } catch {
    return freshSeed() || 1;
  }
};

/**
 * Quiero ver's filters and order live in the URL, but changing them never goes to the server
 * (FIL-I34): `history.replaceState` syncs `useSearchParams`, and the list filters itself on the
 * client — instant, and it keeps working offline.
 */
export const useWatchlistQuery = () => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = useMemo(() => {
    const raw: Record<string, string[]> = {};
    for (const key of new Set(searchParams.keys())) raw[key] = searchParams.getAll(key);
    return parseWatchlistQuery(raw);
  }, [searchParams]);

  const setQuery = useCallback(
    (next: WatchlistQuery) => window.history.replaceState(null, "", watchlistHref(pathname, next)),
    [pathname],
  );

  return { query, setQuery };
};
