"use client";

import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { SearchResultsSkeleton } from "@/components/PageSkeletons";
import { SearchResultRow } from "@/components/tmdb-search/SearchResultRow";
import { staggerStyle } from "@/lib/motion";
import type { TmdbCatalogResult } from "@/lib/tmdb";
import type { TmdbCatalogEntry } from "@/lib/tmdb-search-catalog";
import { tmdbCatalogKey } from "@/lib/tmdb-search-catalog";

type TmdbSearchResultsProps = {
  results: TmdbCatalogResult[];
  catalog: Map<string, TmdbCatalogEntry>;
  isSearching: boolean;
  hasSearched: boolean;
  error: string | null;
  onPreview: (result: TmdbCatalogResult) => void;
  onRetry?: () => void;
};

export const TmdbSearchResults = ({
  results,
  catalog,
  isSearching,
  hasSearched,
  error,
  onPreview,
  onRetry,
}: TmdbSearchResultsProps) => {
  if (results.length > 0) {
    return (
      <section className="space-y-3">
        <header className="flex items-end justify-between">
          <h2 className="text-lg font-semibold text-paper">Resultados</h2>
          <p className="text-sm text-mist">
            {isSearching ? "Buscando…" : results.length}
          </p>
        </header>
        <ul className="space-y-2">
          {results.map((result, index) => {
            const key = tmdbCatalogKey(result.tmdbId, result.kind);
            const local = catalog.get(key) ?? catalog.get(String(result.tmdbId));
            return (
              <li key={key} className="stagger-in" style={staggerStyle(index)}>
                <SearchResultRow
                  result={result}
                  titleId={local?.titleId}
                  status={local?.watched ? "watched" : local?.inWatchlist ? "watchlist" : null}
                  onPreview={onPreview}
                />
              </li>
            );
          })}
        </ul>
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
    return (
      <EmptyState
        variant="buscar"
        title="Nada con esa búsqueda"
        description="Prueba otro título, o cambia entre Películas y Series."
        actionHref="/watchlist"
        actionLabel="Ir a Quiero ver"
      />
    );
  }

  return null;
};
