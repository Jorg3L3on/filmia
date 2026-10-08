"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";
import { saveTmdbTitleInLists } from "@/app/actions/lists";
import { addTitleFromTmdb } from "@/app/actions/titles";
import { pinTonightFromSearch } from "@/app/actions/tonight";
import type { SearchAddDestination, SearchPendingAction } from "@/components/SearchPreviewSheet";
import { useTmdbDiscoverSearch } from "@/components/tmdb-search/useTmdbDiscoverSearch";
import type { TitleKind } from "@/db";
import { titleMatchesKind } from "@/lib/catalog-filters";
import { pulseNav } from "@/lib/fly-to-nav";
import {
  diffListSelection,
  listSelectionToast,
  type SelectableList,
} from "@/lib/list-selection";
import type { TmdbCatalogResult } from "@/lib/tmdb";
import { showToast } from "@/lib/toast";
import type { UserTmdbEntry } from "@/lib/queries";
import { buildPersonSearchHref, type DirectorHit, type PersonRole } from "@/lib/person-filmography";
import { buildSearchHref, type SearchMode } from "@/lib/search-session";
import { PARA_TI_SLUG } from "@/lib/tonight/select";
import { TONIGHT_LENS_PARAM } from "@/lib/tonight/serve";
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
  /** Every list of the user (diarias + propias), for «Agregar a lista». */
  lists?: SelectableList[];
  /** titleId → list ids, so the picker starts on what is already saved. */
  memberships?: Record<string, string[]>;
  /** Title pinned for tonight when the page loaded («Ver esta noche»). */
  pinnedTitleId?: string | null;
  /** `?tipo=director`: the «Director» chip is on. */
  initialMode?: SearchMode;
};

/** A person being opened: painted from the tap while the server loads the filmography. */
export type PendingPerson = {
  id: number;
  name: string;
  profilePath: string | null;
  role: PersonRole;
};

/** «Ver en Hoy»: Para ti, where the pinned card leads. */
const TONIGHT_PIN_HREF = `/?${TONIGHT_LENS_PARAM}=${PARA_TI_SLUG}`;

/** A title new to the user's catalog says where it went (#104 ítem 9). */
const savedInFilmiaCopy = (name: string, created: boolean) =>
  created ? `${name} · se guarda en tu Filmia` : name;

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
}: UseTmdbSearchAddArgs) => {
  const router = useRouter();
  const [catalog, setCatalog] = useState(() => toTmdbCatalogMap(existing));
  const [listIndex, setListIndex] = useState(memberships);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<SearchPendingAction | null>(null);
  const [preview, setPreviewState] = useState<TmdbCatalogResult | null>(null);
  const [listsError, setListsError] = useState<string | null>(null);
  const [pinnedTitleId, setPinnedTitleId] = useState(initialPinnedTitleId);
  /** Result key pinned during this visit: only a fresh pin gets the moon pop. */
  const [justPinnedKey, setJustPinnedKey] = useState<string | null>(null);
  const [tonightError, setTonightError] = useState<string | null>(null);
  const [kindFilter, setKindFilter] = useState<"ALL" | TitleKind>("ALL");
  const [isAdding, startAdd] = useTransition();

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

  const previewLocal = useMemo(() => {
    if (!preview) {
      return null;
    }
    return lookupTmdbCatalogEntry(catalog, preview.tmdbId, preview.kind);
  }, [catalog, preview]);

  const previewListIds = useMemo(() => {
    if (!previewLocal || previewLocal.titleId.startsWith("pending:")) {
      return [];
    }
    return listIndex[previewLocal.titleId] ?? [];
  }, [listIndex, previewLocal]);

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
      const description = savedInFilmiaCopy(result.name, outcome.created);
      showToast(
        destination === "watchlist"
          ? { title: "En Quiero ver", description }
          : { title: "Marcada como vista", description },
      );
    });
  };

  const setPreview = (next: TmdbCatalogResult | null) => {
    setListsError(null);
    setTonightError(null);
    setPreviewState(next);
  };

  /**
   * «Ver esta noche»: into Quiero ver if needed, then first in Para ti. The
   * sheet stays open and confirms; the toast offers Hoy instead of navigating.
   */
  const handlePinTonight = (result: TmdbCatalogResult) => {
    const key = tmdbCatalogKey(result.tmdbId, result.kind);
    setTonightError(null);
    setPendingKey(key);
    setPendingAction("tonight");
    startAdd(async () => {
      const outcome = await pinTonightFromSearch({
        tmdbId: result.tmdbId,
        kind: result.kind,
        name: result.name,
        originalName: result.originalName,
        year: result.year,
        posterPath: result.posterPath,
      });
      setPendingKey(null);
      setPendingAction(null);

      if (!outcome.ok) {
        setTonightError(outcome.error);
        return;
      }

      const previous = lookupTmdbCatalogEntry(catalog, result.tmdbId, result.kind);
      upsertLocal(result, outcome.titleId, {
        inWatchlist: true,
        watched: Boolean(previous?.watched),
      });
      setPinnedTitleId(outcome.titleId);
      setJustPinnedKey(key);
      pulseNav("today");
      showToast({
        title: "Primera en Hoy esta noche",
        description: savedInFilmiaCopy(result.name, outcome.created),
        durationMs: 6000,
        action: { label: "Ver en Hoy", onClick: () => router.push(TONIGHT_PIN_HREF) },
      });
    });
  };

  const watchlistId = lists.find((list) => list.slug === "watchlist")?.id ?? null;

  /** «Agregar a lista»: upsert if needed, then apply the picked lists. Resolves `true` on success. */
  const handleSaveLists = (
    result: TmdbCatalogResult,
    initialIds: string[],
    selectedIds: string[],
  ) =>
    new Promise<boolean>((resolve) => {
      const diff = diffListSelection(initialIds, selectedIds);
      if (!diff.changed) {
        resolve(true);
        return;
      }

      const key = tmdbCatalogKey(result.tmdbId, result.kind);
      setListsError(null);
      setPendingKey(key);
      setPendingAction("lists");
      startAdd(async () => {
        const outcome = await saveTmdbTitleInLists({
          tmdb: {
            tmdbId: result.tmdbId,
            kind: result.kind,
            name: result.name,
            originalName: result.originalName,
            year: result.year,
            posterPath: result.posterPath,
          },
          add: diff.add,
          remove: diff.remove,
        });
        setPendingKey(null);
        setPendingAction(null);

        if (!outcome.ok) {
          setListsError(outcome.error);
          showToast({ title: "No se pudo guardar", description: outcome.error, variant: "error" });
          resolve(false);
          return;
        }

        const previous = lookupTmdbCatalogEntry(catalog, result.tmdbId, result.kind);
        setListIndex((current) => ({ ...current, [outcome.titleId]: selectedIds }));
        upsertLocal(result, outcome.titleId, {
          inWatchlist: watchlistId ? selectedIds.includes(watchlistId) : Boolean(previous?.inWatchlist),
          watched: Boolean(previous?.watched),
        });
        showToast(
          listSelectionToast(lists, diff, savedInFilmiaCopy(result.name, outcome.created)),
        );
        resolve(true);
      });
    });

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
  };
};
