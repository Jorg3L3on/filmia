"use client";

import { EmptyState } from "@/components/EmptyState";
import { SearchPreviewSheet } from "@/components/SearchPreviewSheet";
import { TmdbSearchUnavailable } from "@/components/TmdbSearchUnavailable";
import { TmdbSearchResults } from "@/components/TmdbSearchResults";
import { TmdbKindFilterChips } from "@/components/tmdb-search/TmdbKindFilterChips";
import { TmdbSearchForm } from "@/components/tmdb-search/TmdbSearchForm";
import { useTmdbSearchAdd } from "@/components/tmdb-search/useTmdbSearchAdd";
import type { TmdbCatalogResult } from "@/lib/tmdb";
import type { UserTmdbEntry } from "@/lib/queries";
import { tmdbCatalogKey } from "@/lib/tmdb-search-catalog";

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
  const {
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
  } = useTmdbSearchAdd({
    configuredTmdb: configured.tmdb,
    existing,
    initialQuery,
    initialResults,
    initialError,
    watchedDate,
    defaultDestination,
  });

  if (!configured.tmdb) {
    return <TmdbSearchUnavailable />;
  }

  return (
    <div className="space-y-6">
      <TmdbSearchForm
        query={query}
        onQueryChange={handleQueryChange}
        onSearch={handleSearch}
      />

      <TmdbKindFilterChips
        kindFilter={kindFilter}
        onKindFilterChange={setKindFilter}
      />

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
        onRetry={handleSearch}
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
