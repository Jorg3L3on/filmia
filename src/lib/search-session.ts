import type { TmdbCatalogResult } from "@/lib/tmdb";

export const SEARCH_DEBOUNCE_MS = 280;
export const SEARCH_CACHE_TTL_MS = 5 * 60 * 1000;
export const SEARCH_CACHE_LIMIT = 30;

export type CachedSearch = {
  results: TmdbCatalogResult[];
  error: string | null;
  at: number;
};

const searchCache = new Map<string, CachedSearch>();

export const normalizeSearchQuery = (value: string) =>
  value.trim().replace(/\s+/g, " ");

export const searchCacheKey = (value: string) =>
  normalizeSearchQuery(value).toLowerCase();

export const readSearchCache = (
  query: string,
  now = Date.now(),
): CachedSearch | null => {
  const key = searchCacheKey(query);
  if (!key) {
    return null;
  }

  const entry = searchCache.get(key);
  if (!entry) {
    return null;
  }

  if (now - entry.at > SEARCH_CACHE_TTL_MS) {
    searchCache.delete(key);
    return null;
  }

  return entry;
};

export const writeSearchCache = (
  query: string,
  value: { results: TmdbCatalogResult[]; error: string | null },
  now = Date.now(),
) => {
  const key = searchCacheKey(query);
  if (!key) {
    return;
  }

  if (searchCache.size >= SEARCH_CACHE_LIMIT && !searchCache.has(key)) {
    const oldest = searchCache.keys().next().value;
    if (oldest) {
      searchCache.delete(oldest);
    }
  }

  searchCache.set(key, { ...value, at: now });
};

export const clearSearchCache = () => {
  searchCache.clear();
};

export const createDebounced = <T extends unknown[]>(
  fn: (...args: T) => void,
  wait: number,
) => {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const cancel = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const run = (...args: T) => {
    cancel();
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, wait);
  };

  return { run, cancel };
};

export const buildSearchHref = (
  query: string,
  extras: { watchedDate?: string | null; watchedDestination?: boolean } = {},
) => {
  const next = new URLSearchParams();
  const trimmed = normalizeSearchQuery(query);
  if (trimmed) {
    next.set("q", trimmed);
  }
  if (extras.watchedDate) {
    next.set("fecha", extras.watchedDate);
  }
  if (extras.watchedDestination) {
    next.set("destino", "visto");
  }
  const qs = next.toString();
  return qs ? `/buscar?${qs}` : "/buscar";
};
