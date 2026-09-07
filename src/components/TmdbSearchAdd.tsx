"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { searchTmdbDiscover } from "@/app/actions/metadata";
import { addTitleFromTmdb } from "@/app/actions/titles";
import { EmptyState } from "@/components/EmptyState";
import { PosterImage } from "@/components/PosterImage";
import { SearchPreviewSheet } from "@/components/SearchPreviewSheet";
import type { TitleKind } from "@/db";
import { KIND_CHIPS, titleMatchesKind } from "@/lib/catalog-filters";
import { cn } from "@/lib/cn";
import { TITLE_KIND_LABEL } from "@/lib/labels";
import type { TmdbCatalogResult } from "@/lib/tmdb";
import type { UserTmdbEntry } from "@/lib/queries";
import {
  SEARCH_DEBOUNCE_MS,
  buildSearchHref,
  normalizeSearchQuery,
  readSearchCache,
  writeSearchCache,
} from "@/lib/search-session";
import { btnPrimary, fieldClass, focusRing } from "@/lib/ui";

type CatalogEntry = {
  titleId: string;
  inWatchlist: boolean;
  watched: boolean;
};

const catalogKey = (tmdbId: number, kind: TitleKind) => `${kind}:${tmdbId}`;

const toCatalogMap = (entries: UserTmdbEntry[]) => {
  const next = new Map<string, CatalogEntry>();
  for (const entry of entries) {
    const mapped = {
      titleId: entry.titleId,
      inWatchlist: entry.inWatchlist,
      watched: entry.watched,
    };
    next.set(catalogKey(entry.tmdbId, entry.kind), mapped);
    next.set(String(entry.tmdbId), mapped);
  }
  return next;
};

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
  const [catalog, setCatalog] = useState(() => toCatalogMap(existing));
  const [error, setError] = useState<string | null>(initialError);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<
    "catalog" | "watchlist" | "open" | null
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
    return (
      catalog.get(catalogKey(preview.tmdbId, preview.kind)) ??
      catalog.get(String(preview.tmdbId)) ??
      null
    );
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
        setNotice(null);
        syncSearchUrl(trimmed);
        return;
      }

      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      startSearch(async () => {
        setError(null);
        setNotice(null);
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
      setNotice(null);
      syncSearchUrl("");
      return;
    }

    scheduleSearch(trimmed);
  };

  const upsertLocal = (result: TmdbCatalogResult, titleId: string, inWatchlist: boolean) => {
    setCatalog((current) => {
      const next = new Map(current);
      const entry = { titleId, inWatchlist, watched: defaultDestination === "watched" };
      next.set(catalogKey(result.tmdbId, result.kind), entry);
      next.set(String(result.tmdbId), entry);
      return next;
    });
  };

  const removeLocal = (result: TmdbCatalogResult) => {
    setCatalog((current) => {
      const next = new Map(current);
      next.delete(catalogKey(result.tmdbId, result.kind));
      next.delete(String(result.tmdbId));
      return next;
    });
  };

  const handleAdd = (result: TmdbCatalogResult, destination: "catalog" | "watchlist") => {
    const key = catalogKey(result.tmdbId, result.kind);
    const optimisticId = `pending:${key}`;
    setError(null);
    setNotice(null);
    setPendingKey(key);
    setPendingAction(destination);
    upsertLocal(result, optimisticId, destination === "watchlist");
    startAdd(async () => {
      const outcome = await addTitleFromTmdb({
        tmdbId: result.tmdbId,
        kind: result.kind,
        name: result.name,
        originalName: result.originalName,
        year: result.year,
        posterPath: result.posterPath,
        destination:
          defaultDestination === "watched"
            ? "watched"
            : destination === "watchlist"
              ? "watchlist"
              : undefined,
        addToWatchlist: destination === "watchlist",
        watchedAt: defaultDestination === "watched" ? watchedDate : null,
      });
      setPendingKey(null);
      setPendingAction(null);

      if (!outcome.ok) {
        removeLocal(result);
        setError(outcome.error);
        return;
      }

      upsertLocal(result, outcome.titleId, outcome.addedToWatchlist);
      setNotice(
        destination === "watchlist"
          ? `${result.name} quedó en Quiero ver.`
          : `${result.name} ya está en Filmia.`,
      );
    });
  };

  const handleOpen = (result: TmdbCatalogResult) => {
    const local =
      catalog.get(catalogKey(result.tmdbId, result.kind)) ??
      catalog.get(String(result.tmdbId));
    if (local) {
      if (local.titleId.startsWith("pending:")) {
        return;
      }
      router.push(`/titulos/${local.titleId}`);
      return;
    }

    startAdd(async () => {
      setPendingKey(catalogKey(result.tmdbId, result.kind));
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
      <EmptyState
        variant="buscar"
        title="Busca un título"
        description="Falta la clave de TMDB en el entorno. Sin ella no se puede buscar."
        actionHref="/watchlist"
        actionLabel="Ir a Quiero ver"
      />
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
        <label className="block">
          <span className="sr-only">Buscar títulos en TMDB</span>
          <input
            value={query}
            onChange={(event) => handleQueryChange(event.target.value)}
            placeholder="Interestelar, Dune, Severance…"
            className={`${fieldClass} border-accent/40 py-3 text-base shadow-[0_0_0_3px_rgba(124,156,255,0.18)]`}
            autoComplete="off"
            autoFocus
          />
        </label>
        <button type="submit" className="sr-only">
          Buscar
        </button>
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

      {error ? (
        <p role="alert" className="rounded-xl border border-danger-line bg-danger-well px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {notice ? (
        <p role="status" className="text-sm text-accent">
          {notice}
        </p>
      ) : null}

      {visibleResults.length > 0 ? (
        <section className="space-y-3">
          <header className="flex items-end justify-between">
            <h2 className="text-lg font-semibold text-paper">Resultados</h2>
            <p className="text-sm text-mist">
              {isSearching ? "Buscando…" : visibleResults.length}
            </p>
          </header>
          <ul className="space-y-2">
            {visibleResults.map((result, index) => {
              const key = catalogKey(result.tmdbId, result.kind);
              const local = catalog.get(key) ?? catalog.get(String(result.tmdbId));
              return (
                <li
                  key={key}
                  className="stagger-in"
                  style={{ "--stagger": index } as React.CSSProperties}
                >
                  <button
                    type="button"
                    onClick={() => setPreview(result)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-2xl border border-line bg-surface px-3 py-2.5 text-left hover:border-accent/40",
                      focusRing,
                    )}
                  >
                    <span className="w-12 shrink-0 overflow-hidden rounded-lg">
                      <PosterImage
                        name={result.name}
                        posterPath={result.posterPath}
                        sizes="48px"
                        className="rounded-lg"
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-paper">{result.name}</span>
                      <span className="block text-sm text-fog">
                        {result.year ? `${result.year} · ` : ""}
                        {TITLE_KIND_LABEL[result.kind]}
                      </span>
                      {local ? (
                        <span className="mt-1 inline-flex rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
                          Ya en Filmia
                        </span>
                      ) : null}
                    </span>
                    <span className="text-mist" aria-hidden="true">
                      ›
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : hasSearched && !error && !isSearching ? (
        <EmptyState
          variant="buscar"
          title="Nada con esa búsqueda"
          description="Prueba otro título, o cambia entre Películas y Series."
          actionHref="/watchlist"
          actionLabel="Ir a Quiero ver"
        />
      ) : null}

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
          pending={isAdding && pendingKey === catalogKey(preview.tmdbId, preview.kind)}
          pendingAction={pendingAction}
          onClose={() => setPreview(null)}
          onAdd={(destination) => handleAdd(preview, destination)}
          onOpen={() => handleOpen(preview)}
        />
      ) : null}

      <p className="sr-only">{isSearching ? "Buscando" : isAdding ? "Guardando" : ""}</p>
      <p className="text-center">
        <button
          type="button"
          onClick={handleSearch}
          disabled={isSearching || !query.trim()}
          className={`${btnPrimary} sm:hidden`}
        >
          {isSearching ? "Buscando…" : "Buscar"}
        </button>
      </p>
    </div>
  );
};
