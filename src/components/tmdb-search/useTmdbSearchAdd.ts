"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { searchTmdbDiscover } from "@/app/actions/metadata";
import { addTitleFromTmdb } from "@/app/actions/titles";
import type { SearchAddDestination } from "@/components/SearchPreviewSheet";
import type { TitleKind } from "@/db";
import { titleMatchesKind } from "@/lib/catalog-filters";
import type { TmdbCatalogResult } from "@/lib/tmdb";
import { showToast } from "@/lib/toast";
import type { UserTmdbEntry } from "@/lib/queries";
import {
  SEARCH_DEBOUNCE_MS,
  buildSearchHref,
  normalizeSearchQuery,
  readSearchCache,
  writeSearchCache,
} from "@/lib/search-session";
import {
  lookupTmdbCatalogEntry,
  tmdbCatalogKey,
  toTmdbCatalogMap,
} from "@/lib/tmdb-search-catalog";

type UseTmdbSearchAddArgs = {
  configuredTmdb: boolean;
  existing: UserTmdbEntry[];
  initialQuery?: string;
  initialResults?: TmdbCatalogResult[];
  initialError?: string | null;
  watchedDate?: string | null;
  defaultDestination?: "watchlist" | "watched";
};

export const useTmdbSearchAdd = ({
  configuredTmdb,
  existing,
  initialQuery = "",
  initialResults = [],
  initialError = null,
  watchedDate = null,
  defaultDestination = "watchlist",
}: UseTmdbSearchAddArgs) => {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<TmdbCatalogResult[]>(initialResults);
  const [catalog, setCatalog] = useState(() => toTmdbCatalogMap(existing));
  const [error, setError] = useState<string | null>(initialError);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<
    SearchAddDestination | "open" | null
  >(null);
  const [preview, setPreview] = useState<TmdbCatalogResult | null>(null);
  const [hasSearched, setHasSearched] = useState(Boolean(initialQuery.trim()));
  const [kindFilter, setKindFilter] = useState<"ALL" | TitleKind>("ALL");
  const [isSearching, startSearch] = useTransition();
  const [isAdding, startAdd] = useTransition();
  const requestIdRef = useRef(0);
  const visibleResults = results.filter((result) =>
    titleMatchesKind(result.kind, kindFilter),
  );

  const previewLocal = useMemo(() => {
    if (!preview) {
      return null;
    }
    return lookupTmdbCatalogEntry(catalog, preview.tmdbId, preview.kind);
  }, [catalog, preview]);

  const syncSearchUrl = useCallback(
    (trimmed: string) => {
      if (typeof window === "undefined") {
        return;
      }

      const href = buildSearchHref(trimmed, {
        watchedDate,
        watchedDestination: defaultDestination === "watched",
      });
      window.history.replaceState(window.history.state, "", href);
    },
    [defaultDestination, watchedDate],
  );

  const runSearch = useCallback(
    (rawQuery: string) => {
      const trimmed = normalizeSearchQuery(rawQuery);
      if (!configuredTmdb || !trimmed) {
        return;
      }

      const cached = readSearchCache(trimmed);
      if (cached) {
        setHasSearched(true);
        setResults(cached.results);
        setError(cached.error);
        syncSearchUrl(trimmed);
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
        syncSearchUrl(trimmed);
      });
    },
    [configuredTmdb, syncSearchUrl],
  );

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    if (didMountSearch.current || !initialQuery.trim() || !configuredTmdb) {
      return;
    }

    didMountSearch.current = true;
    runSearch(initialQuery);
  }, [configuredTmdb, initialQuery, runSearch]);

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
      syncSearchUrl("");
      return;
    }

    scheduleSearch(trimmed);
  };

  const upsertLocal = (
    result: TmdbCatalogResult,
    titleId: string,
    next: { inWatchlist: boolean; watched: boolean },
  ) => {
    setCatalog((current) => {
      const nextMap = new Map(current);
      const entry = { titleId, inWatchlist: next.inWatchlist, watched: next.watched };
      nextMap.set(tmdbCatalogKey(result.tmdbId, result.kind), entry);
      nextMap.set(String(result.tmdbId), entry);
      return nextMap;
    });
  };

  const removeLocal = (result: TmdbCatalogResult) => {
    setCatalog((current) => {
      const next = new Map(current);
      next.delete(tmdbCatalogKey(result.tmdbId, result.kind));
      next.delete(String(result.tmdbId));
      return next;
    });
  };

  const handleAdd = (result: TmdbCatalogResult, destination: SearchAddDestination) => {
    const key = tmdbCatalogKey(result.tmdbId, result.kind);
    const optimisticId = `pending:${key}`;
    const previous = lookupTmdbCatalogEntry(catalog, result.tmdbId, result.kind);
    setError(null);
    setPendingKey(key);
    setPendingAction(destination);
    upsertLocal(result, previous?.titleId ?? optimisticId, {
      inWatchlist: destination === "watchlist" || Boolean(previous?.inWatchlist),
      watched: destination === "watched" || Boolean(previous?.watched),
    });
    startAdd(async () => {
      const outcome = await addTitleFromTmdb({
        tmdbId: result.tmdbId,
        kind: result.kind,
        name: result.name,
        originalName: result.originalName,
        year: result.year,
        posterPath: result.posterPath,
        destination,
        addToWatchlist: destination === "watchlist",
        watchedAt: destination === "watched" ? watchedDate : null,
      });
      setPendingKey(null);
      setPendingAction(null);

      if (!outcome.ok) {
        if (previous) {
          upsertLocal(result, previous.titleId, previous);
        } else {
          removeLocal(result);
        }
        setError(outcome.error);
        showToast({ title: "No se pudo guardar", description: outcome.error, variant: "error" });
        return;
      }

      upsertLocal(result, outcome.titleId, {
        inWatchlist: outcome.addedToWatchlist || destination === "watchlist",
        watched: outcome.markedWatched || destination === "watched",
      });
      showToast(
        destination === "watchlist"
          ? { title: "En Quiero ver", description: result.name }
          : { title: "Marcada como vista", description: result.name },
      );
    });
  };

  const handleOpen = (result: TmdbCatalogResult) => {
    const local = lookupTmdbCatalogEntry(catalog, result.tmdbId, result.kind);
    if (local) {
      if (local.titleId.startsWith("pending:")) {
        return;
      }
      router.push(`/titulos/${local.titleId}`);
      return;
    }

    startAdd(async () => {
      setPendingKey(tmdbCatalogKey(result.tmdbId, result.kind));
      setPendingAction("open");
      const outcome = await addTitleFromTmdb({
        tmdbId: result.tmdbId,
        kind: result.kind,
        name: result.name,
        originalName: result.originalName,
        year: result.year,
        posterPath: result.posterPath,
        destination: defaultDestination === "watched" ? "watched" : undefined,
        watchedAt: defaultDestination === "watched" ? watchedDate : null,
      });
      setPendingKey(null);
      setPendingAction(null);
      if (!outcome.ok) {
        setError(outcome.error);
        return;
      }
      router.push(`/titulos/${outcome.titleId}`);
    });
  };

  return {
    query,
    catalog,
    error,
    pendingKey,
    pendingAction,
    preview,
    setPreview,
    hasSearched,
    kindFilter,
    setKindFilter,
    isSearching,
    isAdding,
    visibleResults,
    previewLocal,
    handleSearch,
    handleQueryChange,
    handleAdd,
    handleOpen,
  };
};
