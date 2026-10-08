"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { searchDirectors, searchTmdbDiscover } from "@/app/actions/metadata";
import type { DirectorHit } from "@/lib/person-filmography";
import type { TmdbCatalogResult } from "@/lib/tmdb";
import {
  SEARCH_DEBOUNCE_MS,
  normalizeSearchQuery,
  readSearchCache,
  writeSearchCache,
  type CachedSearch,
  type SearchMode,
} from "@/lib/search-session";

type UseTmdbDiscoverSearchArgs = {
  enabled: boolean;
  initialQuery?: string;
  initialResults?: TmdbCatalogResult[];
  initialError?: string | null;
  /** Buscar's «Director» chip searches people instead of titles. */
  initialMode?: SearchMode;
  /** Called with the settled query ("" when cleared) — Buscar syncs the URL here. */
  onSettled?: (trimmed: string, mode: SearchMode) => void;
};

/**
 * Buscar's TMDB search criteria (multi search, debounce, session cache, stale
 * request guard), shared by /buscar and the «Agregar título» sheet of a list.
 */
export const useTmdbDiscoverSearch = ({
  enabled,
  initialQuery = "",
  initialResults = [],
  initialError = null,
  initialMode = "titles",
  onSettled,
}: UseTmdbDiscoverSearchArgs) => {
  const [query, setQuery] = useState(initialQuery);
  const [mode, setMode] = useState<SearchMode>(initialMode);
  const modeRef = useRef(initialMode);
  const [results, setResults] = useState<TmdbCatalogResult[]>(initialResults);
  const [director, setDirector] = useState<DirectorHit | null>(null);
  const [directors, setDirectors] = useState<DirectorHit[]>([]);
  /** The words the current results answer (the field may already say more). */
  const [settledQuery, setSettledQuery] = useState("");
  const [error, setError] = useState<string | null>(initialError);
  const [hasSearched, setHasSearched] = useState(Boolean(initialQuery.trim()));
  const [isSearching, startSearch] = useTransition();
  const requestIdRef = useRef(0);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applySearch = useCallback((trimmed: string, value: Omit<CachedSearch, "at">) => {
    setSettledQuery(trimmed);
    setHasSearched(true);
    setResults(value.results);
    setDirector(value.director ?? null);
    setDirectors(value.directors ?? []);
    setError(value.error);
  }, []);

  const runSearch = useCallback(
    (rawQuery: string, nextMode: SearchMode = modeRef.current) => {
      const trimmed = normalizeSearchQuery(rawQuery);
      if (!enabled || !trimmed) {
        return;
      }

      const cached = readSearchCache(trimmed, Date.now(), nextMode);
      if (cached) {
        requestIdRef.current += 1;
        applySearch(trimmed, cached);
        onSettled?.(trimmed, nextMode);
        return;
      }

      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      startSearch(async () => {
        setError(null);
        const value: Omit<CachedSearch, "at"> =
          nextMode === "director"
            ? await searchDirectors(trimmed).then(({ directors: hits, error: searchError }) => ({
                results: [],
                directors: hits,
                error: searchError ?? null,
              }))
            : await searchTmdbDiscover(trimmed).then(
                ({ results: hits, director: named, error: searchError }) => ({
                  results: hits,
                  director: named,
                  error: searchError ?? null,
                }),
              );
        if (requestId !== requestIdRef.current) {
          return;
        }

        writeSearchCache(trimmed, value, Date.now(), nextMode);
        applySearch(trimmed, value);
        onSettled?.(trimmed, nextMode);
      });
    },
    [applySearch, enabled, onSettled],
  );

  const cancelDebounce = useCallback(() => {
    if (debounceTimer.current !== null) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }
  }, []);

  const scheduleSearch = useCallback(
    (value: string) => {
      cancelDebounce();
      debounceTimer.current = setTimeout(() => {
        debounceTimer.current = null;
        runSearch(value);
      }, SEARCH_DEBOUNCE_MS);
    },
    [cancelDebounce, runSearch],
  );

  useEffect(() => cancelDebounce, [cancelDebounce]);

  const didMountSearch = useRef(false);

  useEffect(() => {
    if (didMountSearch.current || !initialQuery.trim() || !enabled) {
      return;
    }

    didMountSearch.current = true;
    runSearch(initialQuery);
  }, [enabled, initialQuery, runSearch]);

  const handleSearch = useCallback(() => {
    cancelDebounce();
    runSearch(query);
  }, [cancelDebounce, query, runSearch]);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    const trimmed = normalizeSearchQuery(value);
    if (!trimmed) {
      cancelDebounce();
      requestIdRef.current += 1;
      setResults([]);
      setDirector(null);
      setDirectors([]);
      setHasSearched(false);
      setError(null);
      onSettled?.("", modeRef.current);
      return;
    }

    scheduleSearch(trimmed);
  };

  /** Titles ⇄ Director: search the same words again in the other mode. */
  const changeMode = (nextMode: SearchMode) => {
    if (nextMode === modeRef.current) {
      return;
    }
    modeRef.current = nextMode;
    setMode(nextMode);
    cancelDebounce();
    if (normalizeSearchQuery(query)) {
      runSearch(query, nextMode);
    } else {
      onSettled?.("", nextMode);
    }
  };

  /** Drop query + results (e.g. when the sheet closes). */
  const reset = () => {
    cancelDebounce();
    requestIdRef.current += 1;
    setQuery("");
    setResults([]);
    setDirector(null);
    setDirectors([]);
    setHasSearched(false);
    setError(null);
  };

  return {
    query,
    mode,
    changeMode,
    settledQuery,
    results,
    director,
    directors,
    error,
    setError,
    hasSearched,
    isSearching,
    handleSearch,
    handleQueryChange,
    reset,
  };
};
