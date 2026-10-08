import type { DirectorHit } from "@/lib/person-filmography";
import type { TmdbCatalogResult } from "@/lib/tmdb";

/** Buscar searches titles (Todos / Películas / Series) or directors (`?tipo=director`). */
export type SearchMode = "titles" | "director";

/** Titles-mode chip (Todos / Películas / Series), kept in `?tipo=pelicula|serie` so Back restores it. */
export type SearchKind = "ALL" | "MOVIE" | "SERIES";

const KIND_PARAM: Record<Exclude<SearchKind, "ALL">, string> = { MOVIE: "pelicula", SERIES: "serie" };

export const parseSearchKind = (tipo: string | string[] | undefined): SearchKind => {
  const value = Array.isArray(tipo) ? tipo[0] : tipo;
  return value === KIND_PARAM.MOVIE ? "MOVIE" : value === KIND_PARAM.SERIES ? "SERIES" : "ALL";
};

/**
 * What Buscar should open with. On Back, Next remounts the page with the props
 * cached from the first visit, while the URL (kept by replaceState) has the
 * query/chip the user left with: on a client mount the live URL wins. On a full
 * load both are the same URL, so hydration matches.
 */
export const liveSearchState = (
  search: string | null,
  fallback: { query: string; mode: SearchMode; kind: SearchKind },
) => {
  if (search === null) {
    return fallback;
  }
  const params = new URLSearchParams(search);
  if (params.has("persona")) {
    return fallback;
  }
  const tipo = params.get("tipo") ?? undefined;
  return {
    query: params.get("q") ?? fallback.query,
    mode: tipo === "director" ? ("director" as const) : ("titles" as const),
    kind: parseSearchKind(tipo),
  };
};

export const SEARCH_DEBOUNCE_MS = 280;
export const SEARCH_CACHE_TTL_MS = 5 * 60 * 1000;
export const SEARCH_CACHE_LIMIT = 30;

export type CachedSearch = {
  results: TmdbCatalogResult[];
  error: string | null;
  /** Titles mode: the director whose name is what was typed («Ver filmografía»). */
  director?: DirectorHit | null;
  /** Director mode: the people found. */
  directors?: DirectorHit[];
  at: number;
};

const searchCache = new Map<string, CachedSearch>();

export const normalizeSearchQuery = (value: string) =>
  value.trim().replace(/\s+/g, " ");

export const searchCacheKey = (value: string, mode: SearchMode = "titles") => {
  const key = normalizeSearchQuery(value).toLowerCase();
  return key && mode === "director" ? `director:${key}` : key;
};

export const readSearchCache = (
  query: string,
  now = Date.now(),
  mode: SearchMode = "titles",
): CachedSearch | null => {
  const key = searchCacheKey(query, mode);
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
  value: Omit<CachedSearch, "at">,
  now = Date.now(),
  mode: SearchMode = "titles",
) => {
  const key = searchCacheKey(query, mode);
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
  extras: {
    watchedDate?: string | null;
    watchedDestination?: boolean;
    mode?: SearchMode;
    kind?: SearchKind;
  } = {},
) => {
  const next = new URLSearchParams();
  const trimmed = normalizeSearchQuery(query);
  if (trimmed) {
    next.set("q", trimmed);
  }
  if (extras.mode === "director") {
    next.set("tipo", "director");
  } else if (extras.kind && extras.kind !== "ALL") {
    next.set("tipo", KIND_PARAM[extras.kind]);
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
