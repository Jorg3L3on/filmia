"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState, useTransition } from "react";
import { useTmdbDiscoverSearch } from "@/components/tmdb-search/useTmdbDiscoverSearch";
import { useTmdbTitleActions } from "@/components/tmdb-search/useTmdbTitleActions";
import { titleMatchesKind } from "@/lib/catalog-filters";
import type { SelectableList } from "@/lib/list-selection";
import type { TmdbCatalogResult } from "@/lib/tmdb";
import type { UserTmdbEntry } from "@/lib/queries";
import { buildPersonSearchHref, type DirectorHit, type PersonRole } from "@/lib/person-filmography";
import { buildSearchHref, type SearchKind, type SearchMode } from "@/lib/search-session";

type UseTmdbSearchAddArgs = {
  configuredTmdb: boolean;
  existing: UserTmdbEntry[];
  initialQuery?: string;
  initialResults?: TmdbCatalogResult[];
  initialError?: string | null;
  watchedDate?: string | null;
  defaultDestination?: "watchlist" | "watched";
  /** Every list of the user (diarias + propias), for «Agregar a lista». */
  lists?: SelectableList[];
  /** titleId → list ids, so the picker starts on what is already saved. */
  memberships?: Record<string, string[]>;
  /** Title pinned for tonight when the page loaded («Ver esta noche»). */
  pinnedTitleId?: string | null;
  /** `?tipo=director`: the «Director» chip is on. */
  initialMode?: SearchMode;
  /** `?tipo=pelicula|serie`: the chip survives a trip to a ficha and back. */
  initialKind?: SearchKind;
};

/** A person being opened: painted from the tap while the server loads the filmography. */
export type PendingPerson = {
  id: number;
  name: string;
  profilePath: string | null;
  role: PersonRole;
};

export const useTmdbSearchAdd = ({
  configuredTmdb,
  existing,
  initialQuery = "",
  initialResults = [],
  initialError = null,
  watchedDate = null,
  defaultDestination = "watchlist",
  lists = [],
  memberships = {},
  pinnedTitleId: initialPinnedTitleId = null,
  initialMode = "titles",
  initialKind = "ALL",
}: UseTmdbSearchAddArgs) => {
  const router = useRouter();
  const [kindFilter, setKindFilterState] = useState<SearchKind>(initialKind);
  const kindRef = useRef(kindFilter);

  const syncSearchUrl = useCallback(
    (trimmed: string, mode: SearchMode) => {
      if (typeof window === "undefined") {
        return;
      }
      // The person view owns its URL (`?persona=`); typing leaves it via navigation.
      if (new URLSearchParams(window.location.search).has("persona")) {
        return;
      }

      const href = buildSearchHref(trimmed, {
        watchedDate,
        watchedDestination: defaultDestination === "watched",
        mode,
        kind: kindRef.current,
      });
      window.history.replaceState(window.history.state, "", href);
    },
    [defaultDestination, watchedDate],
  );

  const {
    query,
    mode,
    changeMode,
    settledQuery,
    results,
    director,
    directors,
    error,
    setError,
    hasSearched,
    isSearching,
    handleSearch,
    handleQueryChange,
  } = useTmdbDiscoverSearch({
    enabled: configuredTmdb,
    initialQuery,
    initialResults,
    initialError,
    initialMode,
    onSettled: syncSearchUrl,
  });

  const {
    catalog,
    pendingKey,
    pendingAction,
    isAdding,
    listIdsFor,
    listsError,
    pinnedTitleId,
    justPinnedKey,
    tonightError,
    handleAdd,
    handleSaveLists,
    handlePinTonight,
  } = useTmdbTitleActions({
    existing,
    watchedDate,
    lists,
    memberships,
    pinnedTitleId: initialPinnedTitleId,
    onError: setError,
  });

  /** The chip goes in the URL too, so «atrás» from a ficha lands on the same filtered results. */
  const setKindFilter = (kind: SearchKind) => {
    kindRef.current = kind;
    setKindFilterState(kind);
    syncSearchUrl(query, mode);
  };

  const [pendingPerson, setPendingPerson] = useState<PendingPerson | null>(null);
  const [isOpeningPerson, startOpenPerson] = useTransition();

  /** Director card, «Ver filmografía» or a filmography link → the person view (a real history entry). */
  const openPerson = (hit: Pick<DirectorHit, "id" | "name" | "profilePath">, role: PersonRole = "director") => {
    setPendingPerson({ ...hit, role });
    startOpenPerson(() => {
      router.push(
        buildPersonSearchHref({
          personId: hit.id,
          role,
          name: hit.name,
          query,
          mode: mode === "director" ? "director" : null,
        }),
      );
    });
  };

  /** Leave the person view for the search results of what is typed. */
  const closePerson = () => {
    setPendingPerson(null);
    startOpenPerson(() => {
      router.push(
        buildSearchHref(query, {
          watchedDate,
          watchedDestination: defaultDestination === "watched",
          mode,
        }),
      );
    });
  };

  const visibleResults = results.filter((result) =>
    titleMatchesKind(result.kind, kindFilter),
  );

  return {
    query,
    mode,
    changeMode,
    settledQuery,
    director,
    directors,
    pendingPerson: isOpeningPerson ? pendingPerson : null,
    openPerson,
    closePerson,
    catalog,
    error,
    pendingKey,
    pendingAction,
    hasSearched,
    kindFilter,
    setKindFilter,
    isSearching,
    isAdding,
    visibleResults,
    listIdsFor,
    listsError,
    pinnedTitleId,
    justPinnedKey,
    tonightError,
    handleSearch,
    handleQueryChange,
    handleAdd,
    handleSaveLists,
    handlePinTonight,
  };
};
