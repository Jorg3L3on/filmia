"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { getFilmographyFacts } from "@/app/actions/search-facts";
import { BackButton } from "@/components/BackButton";
import { EmptyState } from "@/components/EmptyState";
import { useNavLabel } from "@/components/NavOriginTracker";
import { SearchResultsSkeleton } from "@/components/PageSkeletons";
import { TmdbSearchUnavailable } from "@/components/TmdbSearchUnavailable";
import { TmdbSearchResults } from "@/components/TmdbSearchResults";
import { BuscarStart, FavoriteDirectors } from "@/components/tmdb-search/BuscarStart";
import {
  DirectorPicker,
  DirectorSuggestion,
  PersonView,
  type PersonViewState,
} from "@/components/tmdb-search/PersonSearch";
import { DiaryBand } from "@/components/tmdb-search/DiaryBand";
import type { SearchRowStatus, SearchRowWiring } from "@/components/tmdb-search/SearchResultRow";
import { useDiaryRowLog } from "@/components/tmdb-search/useDiaryRowLog";
import { useDockSearchBridge } from "@/components/tmdb-search/useDockSearchBridge";
import type { SearchMenuTarget } from "@/components/tmdb-search/SearchRowMenu";
import { SearchShortcuts } from "@/components/tmdb-search/SearchShortcuts";
import {
  TmdbKindFilterChips,
  type BuscarChipValue,
} from "@/components/tmdb-search/TmdbKindFilterChips";
import { usePersonFilmography } from "@/components/tmdb-search/usePersonFilmography";
import { TmdbSearchForm } from "@/components/tmdb-search/TmdbSearchForm";
import { useSearchFacts } from "@/components/tmdb-search/useSearchFacts";
import { useSearchRecents } from "@/components/tmdb-search/useSearchRecents";
import { useTmdbSearchAdd } from "@/components/tmdb-search/useTmdbSearchAdd";
import type { StartArrival, StartDirector } from "@/lib/buscar-start";
import type { SelectableList } from "@/lib/list-selection";
import { resolveDirectorQuery, type PersonFilmography } from "@/lib/person-filmography";
import { FILMOGRAPHY_FACTS_LIMIT } from "@/lib/search-result-facts";

/** The IMDb line at 2.5 s (FIL-I22-4); a big filmography's MX availability gets one more look (FIL-I30-1). */
const FILMOGRAPHY_RETRY_DELAYS_MS = [2500, 3500];
import { buildSearchHref, liveSearchState, type SearchKind, type SearchMode } from "@/lib/search-session";
import type { TmdbCatalogResult } from "@/lib/tmdb";
import type { UserTmdbEntry } from "@/lib/queries";
import { lookupTmdbCatalogEntry } from "@/lib/tmdb-search-catalog";
import { ownedFichaHref, previewFichaHref } from "@/lib/title-preview";

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
  initialKind?: SearchKind;
  /** `?persona=…&rol=…`: the person view, loaded on the server. */
  person?: PersonViewState | null;
  /** Start screen: directors of your Favoritas and 4★+ titles. */
  startDirectors?: StartDirector[];
  /** «Llegó a tu plataforma» start row (FIL-I21-8). */
  startArrivals?: StartArrival[];
  /** Saved streaming platforms: a person's work can filter to them (FIL-I30-2). */
  hasPlatforms?: boolean;
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
  initialKind = "ALL",
  person = null,
  startDirectors = [],
  startArrivals = [],
  hasPlatforms = false,
}: TmdbSearchAddProps) => {
  const router = useRouter();
  const [start] = useState(() =>
    liveSearchState(typeof window === "undefined" ? null : window.location.search, {
      query: initialQuery,
      mode: initialMode,
      kind: initialKind,
    }),
  );
  const {
    query,
    mode,
    changeMode,
    settledQuery,
    director,
    directors,
    pendingPerson,
    openPerson,
    switchPersonRole,
    closePerson,
    catalog,
    error,
    hasSearched,
    kindFilter,
    setKindFilter,
    isSearching,
    isAdding,
    pendingKey,
    pendingAction,
    visibleResults,
    loadedCount,
    total,
    canLoadMore,
    isLoadingMore,
    loadMore,
    listIdsFor,
    listsError,
    pinnedTitleId,
    handleSearch,
    handleQueryChange,
    handleAdd,
    handleSaveLists,
    handlePinTonight,
  } = useTmdbSearchAdd({
    configuredTmdb: configured.tmdb,
    existing,
    initialQuery: start.query,
    initialResults,
    initialError,
    watchedDate,
    defaultDestination,
    lists,
    memberships,
    pinnedTitleId: initialPinnedTitleId,
    initialMode: start.mode,
    initialKind: start.kind,
  });
  const logMode = defaultDestination === "watched";
  const { recents, remember, clear: clearRecents } = useSearchRecents();

  // A search earns a spot in «Recientes» once it led somewhere: a result or a person was opened.
  const rememberQuery = () => remember(settledQuery || query);

  /** FIL-I8: a result is its ficha (yours, or the preview by TMDB); Diario mode rides along. */
  const diaryLog = logMode ? { date: watchedDate } : null;
  const hrefFor = (result: TmdbCatalogResult, titleId: string | null) =>
    titleId && !titleId.startsWith("pending:")
      ? ownedFichaHref(titleId, diaryLog)
      : previewFichaHref(result.kind, result.tmdbId, diaryLog);
  const [menu, setMenu] = useState<SearchMenuTarget | null>(null);
  const closeMenu = useCallback(() => setMenu(null), []);
  const [listsFor, setListsFor] = useState<TmdbCatalogResult | null>(null);
  const factsFor = useSearchFacts(visibleResults);

  // Director chip: one clear match shows the person right here (URL stays
  // ?q=…&tipo=director, so «atrás» never bounces back into it).
  const directorResolution =
    mode === "director" && hasSearched && !isSearching
      ? resolveDirectorQuery(directors, settledQuery)
      : null;
  const inlinePerson = directorResolution?.kind === "person" ? directorResolution.hit : null;
  const inline = usePersonFilmography(inlinePerson);
  const personPage = person !== null || pendingPerson !== null;

  // FIL-I16-1: the person on screen asks the Catalog about its whole work; the
  // best-known titles go first, so OMDb's few calls per visit land where they count.
  const shownPerson: PersonFilmography | null = personPage
    ? person?.kind === "ready" && !pendingPerson
      ? person.data
      : null
    : inlinePerson && inline.state?.kind === "ready"
      ? inline.state.data
      : null;
  const filmographyItems = useMemo(
    () => (shownPerson ? [...shownPerson.entries].sort((a, b) => b.votes - a.votes) : []),
    [shownPerson],
  );
  // The person rides along so the server seeds unknown titles from their (cached) credits.
  const filmographyPerson = shownPerson ? { id: shownPerson.person.id, role: shownPerson.role } : undefined;
  const filmographyFactsFor = useSearchFacts(filmographyItems, {
    load: (items) => getFilmographyFacts(items, filmographyPerson),
    limit: FILMOGRAPHY_FACTS_LIMIT,
    retryDelaysMs: FILMOGRAPHY_RETRY_DELAYS_MS,
  });
  const rowFactsFor = shownPerson ? filmographyFactsFor : factsFor;

  // Diario mode (FIL-I22-3): the check on each row, and «Registrada · día» once it logged here.
  const logFor = useDiaryRowLog({
    enabled: logMode,
    date: watchedDate,
    pendingKey,
    pendingAction,
    statusOf: (result) => statusOf(result).status,
    onLog: (result) => {
      rememberQuery();
      handleAdd(result, "watched");
    },
  });

  const rows: SearchRowWiring = {
    hrefFor,
    factsFor: rowFactsFor,
    logFor,
    pinnedTitleId,
    onOpen: () => rememberQuery(),
    onMenu: (result, anchor, via) => {
      rememberQuery();
      setMenu({ result, anchor, via });
    },
  };
  const openDirector: typeof openPerson = (hit) => {
    rememberQuery();
    openPerson(hit);
  };
  const switchRole = (role: PersonFilmography["role"]) => {
    if (shownPerson) {
      switchPersonRole(shownPerson.person, role);
    }
  };
  // «‹ Buscar · Animals» on the ficha a result opens; the person view names itself.
  const searchedFor = settledQuery.trim();
  useNavLabel(personPage ? null : searchedFor ? `Buscar · ${searchedFor}` : "Buscar");

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

  // Mobile: the field lives in the dock; a person over a search turns its disc into «atrás» (FIL-I22-6).
  useDockSearchBridge({
    query,
    initialQuery: start.query,
    onQueryChange,
    onSubmit: handleSearch,
    backHref:
      personPage && query.trim()
        ? buildSearchHref(query, { watchedDate, watchedDestination: logMode, mode, kind: kindFilter })
        : null,
  });

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
          rows={rows}
          onRetry={() => router.refresh()}
          backLabel={query.trim() ? `Resultados de «${query.trim()}»` : null}
          onBack={closePerson}
          originBack={<BackButton hideWithoutOrigin hideWhenOriginPath="/buscar" className="-mb-1" />}
          onSwitchRole={switchRole}
          hasPlatforms={hasPlatforms}
        />
      ) : (
        <>
          <div className="sticky top-[calc(7.25rem+env(safe-area-inset-top))] z-30 sm:top-[calc(3rem+env(safe-area-inset-top))] -mx-4 bg-canvas/90 px-4 py-2 backdrop-blur sm:static sm:mx-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
            <TmdbKindFilterChips
              value={mode === "director" ? "DIRECTOR" : kindFilter}
              onChange={onChip}
            />
          </div>

          {logMode ? (
            <DiaryBand
              date={watchedDate}
              exitHref={buildSearchHref(query, { mode, kind: kindFilter })}
            />
          ) : null}

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
                rows={rows}
                onRetry={inline.retry}
                backLabel={null}
                onBack={() => undefined}
                onSwitchRole={switchRole}
                hasPlatforms={hasPlatforms}
              />
            ) : directorResolution?.kind === "choose" ? (
              <DirectorPicker directors={directorResolution.hits} onOpen={(hit) => openDirector(hit)} />
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
                rows={rows}
                onRetry={handleSearch}
              />
            ) : null
          ) : (
            <>
              {director && !isSearching ? (
                <DirectorSuggestion director={director} onOpen={(hit) => openDirector(hit)} />
              ) : null}
              <TmdbSearchResults
                results={visibleResults}
                catalog={catalog}
                isSearching={isSearching}
                hasSearched={hasSearched}
                error={error}
                rows={rows}
                onRetry={handleSearch}
                kind={kindFilter}
                loadedCount={loadedCount}
                total={total}
                canLoadMore={canLoadMore}
                isLoadingMore={isLoadingMore}
                onLoadMore={loadMore}
                hint={
                  <p className="text-xs text-mist">Si no aparece, prueba con el título original o un año.</p>
                }
                query={settledQuery}
                onSearchAsDirector={() => changeMode("director")}
                onDropYear={onQueryChange}
              />
            </>
          )}

          {/* The start screen leaves as soon as there is text: the skeleton takes its place (FIL-I22-4). */}
          {!hasSearched && !query.trim() ? (
            mode === "director" ? (
              startDirectors.length > 0 ? (
                <FavoriteDirectors directors={startDirectors} />
              ) : (
                <EmptyState
                  variant="buscar"
                  title="Busca un director"
                  description="Escribe su nombre y verás su filmografía, de lo más reciente a lo primero."
                />
              )
            ) : (
              <BuscarStart
                recents={recents}
                directors={startDirectors}
                arrivals={startArrivals}
                onPickRecent={onQueryChange}
                onClearRecents={clearRecents}
                logDate={logMode ? watchedDate : undefined}
              />
            )
          ) : null}
        </>
      )}

      <SearchShortcuts
        menu={menu}
        onCloseMenu={closeMenu}
        listsFor={listsFor}
        onCloseLists={() => setListsFor(null)}
        statusOf={statusOf}
        factsFor={rowFactsFor}
        logMode={logMode}
        logDate={watchedDate}
        pinnedTitleId={pinnedTitleId}
        hrefFor={hrefFor}
        lists={lists ?? []}
        listIdsFor={listIdsFor}
        listsPending={isAdding}
        listsError={listsError}
        onAdd={handleAdd}
        onPin={handlePinTonight}
        onPickLists={setListsFor}
        onSaveLists={handleSaveLists}
        onOpenFicha={(href) => router.push(href)}
      />

      <p className="sr-only">{isSearching ? "Buscando" : isAdding ? "Guardando" : ""}</p>
    </div>
  );
};
