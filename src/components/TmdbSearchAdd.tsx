"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { searchTmdbDiscover } from "@/app/actions/metadata";
import { addTitleFromTmdb } from "@/app/actions/titles";
import { EmptyState } from "@/components/EmptyState";
import { SearchPreviewSheet, type SearchAddDestination } from "@/components/SearchPreviewSheet";
import { TmdbSearchResults } from "@/components/TmdbSearchResults";
import type { TitleKind } from "@/db";
import { KIND_CHIPS, titleMatchesKind } from "@/lib/catalog-filters";
import { cn } from "@/lib/cn";
import { TMDB_UNAVAILABLE_COPY, type TmdbCatalogResult } from "@/lib/tmdb";
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
import { fieldClass, focusRing } from "@/lib/ui";

type TmdbSearchAddProps = {
  configured: { tmdb: boolean; omdb: boolean };
  existing: UserTmdbEntry[];
  initialQuery?: string;
  initialResults?: TmdbCatalogResult[];
  initialError?: string | null;
  watchedDate?: string | null;
  defaultDestination?: "watchlist" | "watched";
};

export const TmdbSearchAdd = ({
  configured,
  existing,
  initialQuery = "",
  initialResults = [],
  initialError = null,
  watchedDate = null,
  defaultDestination = "watchlist",
}: TmdbSearchAddProps) => {
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
      if (!configured.tmdb || !trimmed) {
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

        const nextError =
          searchError ?? (hits.length === 0 ? "Nada en TMDB con esa búsqueda." : null);
        writeSearchCache(trimmed, { results: hits, error: nextError });
        setHasSearched(true);
        setResults(hits);
        setError(nextError);
        syncSearchUrl(trimmed);
      });
    },
    [configured.tmdb, syncSearchUrl],
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
    if (didMountSearch.current || !initialQuery.trim() || !configured.tmdb) {
      return;
    }

    didMountSearch.current = true;
    runSearch(initialQuery);
  }, [configured.tmdb, initialQuery, runSearch]);

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

  if (!configured.tmdb) {
    return (
      <div className="space-y-6">
        <label className="block">
          <span className="sr-only">Buscar títulos</span>
          <input
            disabled
            placeholder="Interestelar, Dune, Severance…"
            className={`${fieldClass} cursor-not-allowed py-3 text-base opacity-60`}
            aria-disabled="true"
          />
        </label>
        <EmptyState
          variant="buscar"
          title="Búsqueda no disponible"
          description={TMDB_UNAVAILABLE_COPY}
          actionHref="/watchlist"
          actionLabel="Ir a Quiero ver"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          handleSearch();
        }}
        className="sticky top-16 z-30 bg-canvas/95 py-2 backdrop-blur"
      >
        <label className="relative block">
          <span className="sr-only">Buscar títulos en TMDB</span>
          <input
            value={query}
            onChange={(event) => handleQueryChange(event.target.value)}
            placeholder="Interestelar, Dune, Severance…"
            className={`${fieldClass} border-accent/40 py-3 pr-12 text-base shadow-[0_0_0_3px_rgba(124,156,255,0.18)]`}
            autoComplete="off"
            autoFocus
          />
          <button
            type="submit"
            className={`${focusRing} absolute top-1/2 right-2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-accent hover:bg-accent/10`}
            aria-label="Buscar"
          >
            <SearchIcon />
          </button>
        </label>
      </form>

      <div
        role="group"
        aria-label="Filtro por tipo"
        className="rail flex gap-2 overflow-x-auto"
      >
        {KIND_CHIPS.map((chip) => {
          const isCurrent = kindFilter === chip.value;
          return (
            <button
              key={chip.value}
              type="button"
              aria-pressed={isCurrent}
              onClick={() => setKindFilter(chip.value)}
              className={cn(
                "shrink-0 rounded-full px-4 py-2 text-sm font-medium",
                focusRing,
                isCurrent ? "bg-accent text-ink" : "bg-well text-paper hover:bg-chrome",
              )}
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      {error && visibleResults.length > 0 ? (
        <p role="alert" className="rounded-xl border border-danger-line bg-danger-well px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <TmdbSearchResults
        results={visibleResults}
        catalog={catalog}
        isSearching={isSearching}
        hasSearched={hasSearched}
        error={error}
        onPreview={setPreview}
      />

      {!hasSearched ? (
        <EmptyState
          variant="buscar"
          title="Busca un título"
          description="Escribe el nombre y pulsa Enter. Luego agrégalo a Quiero ver o a una lista."
        />
      ) : null}

      {preview ? (
        <SearchPreviewSheet
          result={preview}
          local={previewLocal}
          pending={isAdding && pendingKey === tmdbCatalogKey(preview.tmdbId, preview.kind)}
          pendingAction={pendingAction}
          onClose={() => setPreview(null)}
          onAdd={(destination) => handleAdd(preview, destination)}
          onOpen={() => handleOpen(preview)}
        />
      ) : null}

      <p className="sr-only">{isSearching ? "Buscando" : isAdding ? "Guardando" : ""}</p>
      <p className="text-center text-xs text-mist">
        Si no aparece, prueba con el título original o un año.
      </p>
    </div>
  );
};

const SearchIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className="h-5 w-5"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    aria-hidden="true"
  >
    <circle cx="11" cy="11" r="5.5" />
    <path strokeLinecap="round" d="m15.5 15.5 4 4" />
  </svg>
);
