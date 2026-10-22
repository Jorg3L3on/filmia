"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { SearchResultsSkeleton } from "@/components/PageSkeletons";
import { SearchResultRow, type SearchRowWiring } from "@/components/tmdb-search/SearchResultRow";
import { WatchlistCountTicker } from "@/components/watchlist/WatchlistCountTicker";
import { cn } from "@/lib/cn";
import type { SearchKind } from "@/lib/search-session";
import { staggerStyle } from "@/lib/motion";
import { focusRing } from "@/lib/ui";
import type { TmdbCatalogResult } from "@/lib/tmdb";
import type { TmdbCatalogEntry } from "@/lib/tmdb-search-catalog";
import { tmdbCatalogKey } from "@/lib/tmdb-search-catalog";

type TmdbSearchResultsProps = {
  results: TmdbCatalogResult[];
  catalog: Map<string, TmdbCatalogEntry>;
  isSearching: boolean;
  hasSearched: boolean;
  error: string | null;
  rows: SearchRowWiring;
  onRetry?: () => void;
  /** Paging (FIL-I22-4): the chip in force, titles loaded (every kind), titles TMDB has, and the next page. */
  kind?: SearchKind;
  loadedCount?: number;
  total?: number;
  canLoadMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  /** «Si no aparece, prueba…», shown next to the button at the end of the list. */
  hint?: ReactNode;
  /** The words searched (the empty state offers to drop a trailing year). */
  query?: string;
  /** Empty state (FIL-I22-5): the same words under the Director chip, or without the year. */
  onSearchAsDirector?: () => void;
  onDropYear?: (query: string) => void;
};

/** «Interestelar 2014» → the year to drop, if any. */
export const trailingYear = (query: string) => /\s\d{4}$/.test(query.trim()) ? query.trim().slice(0, -4).trim() : null;

const emptyChipClass = cn(
  "press-scale tab-transition inline-flex h-10 items-center rounded-full border border-white/12 bg-white/[0.06] px-4 text-sm font-medium text-paper hover:border-accent/40 hover:bg-white/10",
  focusRing,
);

/** «11 películas de 16» when a chip filters the list; «16 resultados» otherwise. */
const KIND_NOUN: Record<Exclude<SearchKind, "ALL">, [string, string]> = {
  MOVIE: ["película", "películas"],
  SERIES: ["serie", "series"],
};

export const TmdbSearchResults = ({
  results,
  catalog,
  isSearching,
  hasSearched,
  error,
  rows,
  onRetry,
  kind = "ALL",
  loadedCount = results.length,
  total = loadedCount,
  canLoadMore = false,
  isLoadingMore = false,
  onLoadMore,
  hint,
  query = "",
  onSearchAsDirector,
  onDropYear,
}: TmdbSearchResultsProps) => {
  if (results.length > 0) {
    const filtered = kind !== "ALL" && results.length !== loadedCount;
    const noun = kind !== "ALL" ? KIND_NOUN[kind] : (["resultado", "resultados"] as const);
    return (
      <section className="space-y-3" aria-labelledby="buscar-resultados">
        <header className="flex items-baseline justify-between gap-3">
          <h2 id="buscar-resultados" className="text-[11px] font-medium uppercase tracking-[0.2em] text-mist">
            Resultados
          </h2>
          {/* Stays mounted while a new search runs so the digits roll to the new count. */}
          <p className="flex items-baseline gap-1.5 text-xs text-mist" data-search-count>
            {isSearching ? <span className="buscar-shiny">Buscando…</span> : null}
            <WatchlistCountTicker count={results.length} singular={noun[0]} plural={noun[1]} />
            {filtered ? <span>{" "}de {loadedCount}</span> : null}
          </p>
        </header>
        <ul className="grid grid-cols-[minmax(0,1fr)] gap-2 lg:grid-cols-2 lg:gap-3">
          {results.map((result, index) => {
            const key = tmdbCatalogKey(result.tmdbId, result.kind);
            const local = catalog.get(key) ?? catalog.get(String(result.tmdbId));
            const titleId = local?.titleId ?? null;
            return (
              <li key={key} className="stagger-in" style={staggerStyle(index)}>
                <SearchResultRow
                  result={result}
                  titleId={titleId}
                  status={local?.watched ? "watched" : local?.inWatchlist ? "watchlist" : null}
                  facts={rows.factsFor?.(result) ?? null}
                  href={rows.hrefFor(result, titleId)}
                  onOpen={rows.onOpen}
                  onMenu={rows.onMenu}
                  log={rows.logFor?.(result) ?? null}
                  pinned={titleId !== null && titleId === rows.pinnedTitleId}
                />
              </li>
            );
          })}
        </ul>
        <footer className="space-y-3 pt-1" data-search-more>
          {canLoadMore && onLoadMore ? (
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-mist">
                {loadedCount} de {Math.max(total, loadedCount)}
              </p>
              <Button
                type="button"
                variant="secondary"
                onClick={onLoadMore}
                pending={isLoadingMore}
                pendingLabel="Cargando…"
                className="h-11 min-h-11 press-scale"
              >
                Cargar 20 más
              </Button>
            </div>
          ) : loadedCount > 1 ? (
            <p className="text-xs text-mist">{loadedCount} de {loadedCount}</p>
          ) : null}
          {hint}
        </footer>
      </section>
    );
  }

  if (isSearching) {
    return <SearchResultsSkeleton />;
  }

  if (hasSearched && error) {
    return (
      <div className="space-y-3 rounded-2xl border border-danger-line bg-danger-well px-4 py-8 text-center sm:px-6">
        <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-danger">
          Corte
        </p>
        <h2 className="font-serif text-2xl text-paper">No se pudo buscar</h2>
        <p className="mx-auto max-w-md text-sm leading-relaxed text-fog">{error}</p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          {onRetry ? (
            <Button type="button" variant="secondary" onClick={onRetry}>
              Reintentar
            </Button>
          ) : null}
          <Button href="/watchlist" variant="ghost">
            Ir a Quiero ver
          </Button>
        </div>
      </div>
    );
  }

  if (hasSearched && !error) {
    const withoutYear = trailingYear(query);
    return (
      <EmptyState
        variant="buscar"
        title="Nada con esa búsqueda"
        description="Prueba otro título, o cambia entre Películas y Series."
        actions={
          onSearchAsDirector || (withoutYear && onDropYear) ? (
            <>
              {onSearchAsDirector ? (
                <button type="button" onClick={onSearchAsDirector} className={emptyChipClass}>
                  Buscar como director
                </button>
              ) : null}
              {withoutYear && onDropYear ? (
                <button type="button" onClick={() => onDropYear(withoutYear)} className={emptyChipClass}>
                  Quitar el año
                </button>
              ) : null}
            </>
          ) : undefined
        }
      />
    );
  }

  return null;
};
