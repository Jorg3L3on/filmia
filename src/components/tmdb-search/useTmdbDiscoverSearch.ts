"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { searchTmdbDiscover } from "@/app/actions/metadata";
import type { TmdbCatalogResult } from "@/lib/tmdb";
import {
  SEARCH_DEBOUNCE_MS,
  normalizeSearchQuery,
  readSearchCache,
  writeSearchCache,
} from "@/lib/search-session";

type UseTmdbDiscoverSearchArgs = {
  enabled: boolean;
  initialQuery?: string;
  initialResults?: TmdbCatalogResult[];
  initialError?: string | null;
  /** Called with the settled query ("" when cleared) — Buscar syncs the URL here. */
  onSettled?: (trimmed: string) => void;
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
  onSettled,
}: UseTmdbDiscoverSearchArgs) => {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<TmdbCatalogResult[]>(initialResults);
  const [error, setError] = useState<string | null>(initialError);
  const [hasSearched, setHasSearched] = useState(Boolean(initialQuery.trim()));
  const [isSearching, startSearch] = useTransition();
  const requestIdRef = useRef(0);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback(
    (rawQuery: string) => {
      const trimmed = normalizeSearchQuery(rawQuery);
      if (!enabled || !trimmed) {
        return;
      }

      const cached = readSearchCache(trimmed);
      if (cached) {
        setHasSearched(true);
        setResults(cached.results);
        setError(cached.error);
        onSettled?.(trimmed);
        return;
      }

      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      startSearch(async () => {
        setError(null);
        const { results: hits, error: searchError } = await searchTmdbDiscover(trimmed);
        if (requestId !== requestIdRef.current) {
          return;
        }

        const nextError = searchError ?? null;
        writeSearchCache(trimmed, { results: hits, error: nextError });
        setHasSearched(true);
        setResults(hits);
        setError(nextError);
        onSettled?.(trimmed);
      });
    },
    [enabled, onSettled],
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
      setHasSearched(false);
      setError(null);
      onSettled?.("");
      return;
    }

    scheduleSearch(trimmed);
  };

  /** Drop query + results (e.g. when the sheet closes). */
  const reset = () => {
    cancelDebounce();
    requestIdRef.current += 1;
    setQuery("");
    setResults([]);
    setHasSearched(false);
    setError(null);
  };

  return {
    query,
    results,
    error,
    setError,
    hasSearched,
    isSearching,
    handleSearch,
    handleQueryChange,
    reset,
  };
};
