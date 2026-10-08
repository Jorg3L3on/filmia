"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import { SearchResultsSkeleton } from "@/components/PageSkeletons";
import { SearchPreviewSheet } from "@/components/SearchPreviewSheet";
import { TmdbSearchUnavailable } from "@/components/TmdbSearchUnavailable";
import { TmdbSearchResults } from "@/components/TmdbSearchResults";
import {
  DirectorPicker,
  DirectorSuggestion,
  PersonView,
  type PersonViewState,
} from "@/components/tmdb-search/PersonSearch";
import type { SearchRowStatus } from "@/components/tmdb-search/SearchResultRow";
import {
  TmdbKindFilterChips,
  type BuscarChipValue,
} from "@/components/tmdb-search/TmdbKindFilterChips";
import { usePersonFilmography } from "@/components/tmdb-search/usePersonFilmography";
import { TmdbSearchForm } from "@/components/tmdb-search/TmdbSearchForm";
import { useTmdbSearchAdd } from "@/components/tmdb-search/useTmdbSearchAdd";
import { dockSearch } from "@/lib/dock-search";
import type { SelectableList } from "@/lib/list-selection";
import { resolveDirectorQuery } from "@/lib/person-filmography";
import { buildSearchHref, type SearchMode } from "@/lib/search-session";
import type { TmdbCatalogResult } from "@/lib/tmdb";
import type { UserTmdbEntry } from "@/lib/queries";
import { lookupTmdbCatalogEntry, tmdbCatalogKey } from "@/lib/tmdb-search-catalog";
import { canOfferTonightPin } from "@/lib/tonight/pin";

type TmdbSearchAddProps = {
  configured: { tmdb: boolean; omdb: boolean };
  existing: UserTmdbEntry[];
  initialQuery?: string;
  initialResults?: TmdbCatalogResult[];
  initialError?: string | null;
  watchedDate?: string | null;
  defaultDestination?: "watchlist" | "watched";
  lists?: SelectableList[];
  memberships?: Record<string, string[]>;
  pinnedTitleId?: string | null;
  /** `?tipo=director`. */
  initialMode?: SearchMode;
  /** `?persona=…&rol=…`: the person view, loaded on the server. */
  person?: PersonViewState | null;
};

export const TmdbSearchAdd = ({
  configured,
  existing,
  initialQuery = "",
  initialResults = [],
  initialError = null,
  watchedDate = null,
  defaultDestination = "watchlist",
  lists,
  memberships,
  pinnedTitleId: initialPinnedTitleId = null,
  initialMode = "titles",
  person = null,
}: TmdbSearchAddProps) => {
  const router = useRouter();
  const {
    query,
    mode,
    changeMode,
    settledQuery,
    director,
    directors,
    pendingPerson,
    openPerson,
    closePerson,
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
    previewListIds,
    listsError,
    pinnedTitleId,
    justPinnedKey,
    tonightError,
    handleSearch,
    handleQueryChange,
    handleAdd,
    handleOpen,
    handleSaveLists,
    handlePinTonight,
  } = useTmdbSearchAdd({
    configuredTmdb: configured.tmdb,
    existing,
    initialQuery,
    initialResults,
    initialError,
    watchedDate,
    defaultDestination,
    lists,
    memberships,
    pinnedTitleId: initialPinnedTitleId,
    initialMode,
  });
  const logMode = defaultDestination === "watched";

  // Director chip: one clear match shows the person right here (URL stays
  // ?q=…&tipo=director, so «atrás» never bounces back into it).
  const directorResolution =
    mode === "director" && hasSearched && !isSearching
      ? resolveDirectorQuery(directors, settledQuery)
      : null;
  const inlinePerson = directorResolution?.kind === "person" ? directorResolution.hit : null;
  const inline = usePersonFilmography(inlinePerson);
  const personPage = person !== null || pendingPerson !== null;

  const statusOf = (result: TmdbCatalogResult) => {
    const local = lookupTmdbCatalogEntry(catalog, result.tmdbId, result.kind);
    const status: SearchRowStatus = local?.watched ? "watched" : local?.inWatchlist ? "watchlist" : null;
    return { titleId: local?.titleId ?? null, status };
  };

  const onChip = (value: BuscarChipValue) => {
    if (value === "DIRECTOR") {
      changeMode("director");
      return;
    }
    setKindFilter(value);
    changeMode("titles");
  };

  /** Typing while a person is open goes back to searching (one navigation; the URL then follows the search). */
  const [leavingPerson, setLeavingPerson] = useState(false);
  if (!person && leavingPerson) {
    setLeavingPerson(false);
  }
  const onQueryChange = (value: string) => {
    handleQueryChange(value);
    if (person && !leavingPerson) {
      setLeavingPerson(true);
      router.replace(buildSearchHref(value, { mode }));
    }
  };

  // Mobile: the field lives in the dock (DockSearchField). Mirror the query to
  // it and take its edits; words typed before this mounted are picked up here.
  const dockHandlers = useRef({ change: onQueryChange, submit: handleSearch });
  useEffect(() => {
    dockHandlers.current = { change: onQueryChange, submit: handleSearch };
  });
  useEffect(() => {
    const pending = dockSearch.pendingQuery();
    const unregister = dockSearch.register({
      change: (value) => dockHandlers.current.change(value),
      submit: () => dockHandlers.current.submit(),
    });
    if (pending && pending !== initialQuery) {
      dockHandlers.current.change(pending);
    }
    return unregister;
  }, [initialQuery]);
  useEffect(() => {
    dockSearch.syncFromPage(query);
  }, [query]);

  // Keep the last preview mounted while the sheet plays its exit animation.
  const [sheetResult, setSheetResult] = useState(preview);
  if (preview && preview !== sheetResult) {
    setSheetResult(preview);
  }

  if (!configured.tmdb) {
    return <TmdbSearchUnavailable />;
  }

  return (
    <div className="space-y-6">
      <TmdbSearchForm
        query={query}
        onQueryChange={onQueryChange}
        onSearch={handleSearch}
      />

      {personPage ? (
        <PersonView
          state={person}
          pending={pendingPerson}
          statusOf={statusOf}
          onPreview={setPreview}
          onRetry={() => router.refresh()}
          backLabel={query.trim() ? `Resultados de «${query.trim()}»` : null}
          onBack={closePerson}
        />
      ) : (
        <>
          <div className="sticky top-[calc(3rem+env(safe-area-inset-top))] z-30 -mx-4 bg-canvas/90 px-4 py-2 backdrop-blur sm:static sm:mx-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
            <TmdbKindFilterChips
              value={mode === "director" ? "DIRECTOR" : kindFilter}
              onChange={onChip}
            />
          </div>

          {error && (mode === "director" ? directors.length > 0 : visibleResults.length > 0) ? (
            <p role="alert" className="rounded-xl border border-danger-line bg-danger-well px-3 py-2 text-sm text-danger">
              {error}
            </p>
          ) : null}

          {mode === "director" ? (
            isSearching ? (
              <SearchResultsSkeleton />
            ) : inlinePerson ? (
              <PersonView
                state={inline.state}
                pending={null}
                statusOf={statusOf}
                onPreview={setPreview}
                onRetry={inline.retry}
                backLabel={null}
                onBack={() => undefined}
              />
            ) : directorResolution?.kind === "choose" ? (
              <DirectorPicker directors={directorResolution.hits} onOpen={(hit) => openPerson(hit)} />
            ) : directorResolution?.kind === "none" && !error ? (
              <EmptyState
                variant="buscar"
                title="No encontramos a ese director"
                description="Revisa el nombre, o búscalo en Todos para ver sus películas por título."
              />
            ) : hasSearched && error ? (
              <TmdbSearchResults
                results={[]}
                catalog={catalog}
                isSearching={false}
                hasSearched
                error={error}
                onPreview={setPreview}
                onRetry={handleSearch}
              />
            ) : null
          ) : (
            <>
              {director && !isSearching ? (
                <DirectorSuggestion director={director} onOpen={(hit) => openPerson(hit)} />
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
            </>
          )}

          {!hasSearched ? (
            <EmptyState
              variant="buscar"
              title={mode === "director" ? "Busca un director" : "Busca un título"}
              description={
                mode === "director"
                  ? "Escribe su nombre y verás su filmografía, de lo más reciente a lo primero."
                  : "Escribe el nombre y pulsa Enter. Luego agrégalo a Quiero ver o a una lista."
              }
            />
          ) : null}
        </>
      )}

      {sheetResult ? (
        <SearchPreviewSheet
          open={Boolean(preview)}
          result={sheetResult}
          local={previewLocal}
          pending={isAdding && pendingKey === tmdbCatalogKey(sheetResult.tmdbId, sheetResult.kind)}
          pendingAction={pendingAction}
          onClose={() => setPreview(null)}
          onAdd={(destination) => handleAdd(sheetResult, destination)}
          onOpen={() => handleOpen(sheetResult)}
          lists={lists}
          memberListIds={previewListIds}
          error={listsError}
          onSaveLists={(initialIds, selectedIds) =>
            handleSaveLists(sheetResult, initialIds, selectedIds)
          }
          tonight={
            canOfferTonightPin({ watched: Boolean(previewLocal?.watched), logMode })
              ? {
                  done: Boolean(previewLocal && previewLocal.titleId === pinnedTitleId),
                  celebrate:
                    justPinnedKey === tmdbCatalogKey(sheetResult.tmdbId, sheetResult.kind),
                  error: tonightError,
                  onPin: () => handlePinTonight(sheetResult),
                }
              : null
          }
        />
      ) : null}

      <p className="sr-only">{isSearching ? "Buscando" : isAdding ? "Guardando" : ""}</p>
      {!personPage && mode === "titles" ? (
        <p className="text-center text-xs text-mist">
          Si no aparece, prueba con el título original o un año.
        </p>
      ) : null}
    </div>
  );
};
