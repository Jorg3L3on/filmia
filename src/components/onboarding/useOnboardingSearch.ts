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

type Options = {
  enabled: boolean;
  /** Keep only titles from this year (the «Lo mejor del año» mini search). */
  year?: number | null;
  kind?: "MOVIE" | "SERIES" | null;
};

/** Debounced TMDB multi search without URL sync (the /buscar hook owns the address bar). */
export const useOnboardingSearch = ({ enabled, year = null, kind = null }: Options) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TmdbCatalogResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [isSearching, startSearch] = useTransition();
  const requestId = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filter = useCallback(
    (hits: TmdbCatalogResult[]) =>
      hits.filter(
        (hit) => (year == null || hit.year === year) && (kind == null || hit.kind === kind),
      ),
    [year, kind],
  );

  const run = useCallback(
    (raw: string) => {
      const trimmed = normalizeSearchQuery(raw);
      if (!enabled || !trimmed) {
        return;
      }
      const cached = readSearchCache(trimmed);
      if (cached) {
        setResults(filter(cached.results));
        setError(cached.error);
        setHasSearched(true);
        return;
      }
      const id = requestId.current + 1;
      requestId.current = id;
      startSearch(async () => {
        const { results: hits, error: searchError } = await searchTmdbDiscover(trimmed);
        if (id !== requestId.current) {
          return;
        }
        writeSearchCache(trimmed, { results: hits, error: searchError ?? null });
        setResults(filter(hits));
        setError(searchError ?? null);
        setHasSearched(true);
      });
    },
    [enabled, filter],
  );

  const onQueryChange = (value: string) => {
    setQuery(value);
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (!normalizeSearchQuery(value)) {
      requestId.current += 1;
      setResults([]);
      setHasSearched(false);
      setError(null);
      return;
    }
    timer.current = setTimeout(() => run(value), SEARCH_DEBOUNCE_MS);
  };

  const clear = () => onQueryChange("");

  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    },
    [],
  );

  return { query, onQueryChange, submit: () => run(query), clear, results, error, hasSearched, isSearching };
};
