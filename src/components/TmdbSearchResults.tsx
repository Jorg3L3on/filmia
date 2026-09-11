"use client";

import type { CSSProperties } from "react";
import { SharedPoster } from "@/components/SharedPoster";
import { PosterImage } from "@/components/PosterImage";
import { EmptyState } from "@/components/EmptyState";
import { cn } from "@/lib/cn";
import { TITLE_KIND_LABEL } from "@/lib/labels";
import type { TmdbCatalogResult } from "@/lib/tmdb";
import { focusRing } from "@/lib/ui";
import type { TmdbCatalogEntry } from "@/lib/tmdb-search-catalog";
import { tmdbCatalogKey } from "@/lib/tmdb-search-catalog";

type TmdbSearchResultsProps = {
  results: TmdbCatalogResult[];
  catalog: Map<string, TmdbCatalogEntry>;
  isSearching: boolean;
  hasSearched: boolean;
  error: string | null;
  onPreview: (result: TmdbCatalogResult) => void;
};

export const TmdbSearchResults = ({
  results,
  catalog,
  isSearching,
  hasSearched,
  error,
  onPreview,
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
              <li
                key={key}
                className="stagger-in"
                style={{ "--stagger": index } as CSSProperties}
              >
                <button
                  type="button"
                  onClick={() => onPreview(result)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-2xl border border-line bg-surface px-3 py-2.5 text-left hover:border-accent/40",
                    focusRing,
                  )}
                >
                  <span className="w-12 shrink-0 overflow-hidden rounded-lg">
                    {local?.titleId ? (
                      <SharedPoster titleId={local.titleId}>
                        <PosterImage
                          name={result.name}
                          posterPath={result.posterPath}
                          sizes="48px"
                          className="rounded-lg"
                        />
                      </SharedPoster>
                    ) : (
                      <PosterImage
                        name={result.name}
                        posterPath={result.posterPath}
                        sizes="48px"
                        className="rounded-lg"
                      />
                    )}
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
    );
  }

  if (hasSearched && error && !isSearching) {
    return (
      <EmptyState
        variant="buscar"
        title="No se pudo buscar"
        description={error}
        actionHref="/watchlist"
        actionLabel="Ir a Quiero ver"
      />
    );
  }

  if (hasSearched && !error && !isSearching) {
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
