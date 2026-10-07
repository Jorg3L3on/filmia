"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";
import { saveTmdbTitleInLists } from "@/app/actions/lists";
import { addTitleFromTmdb } from "@/app/actions/titles";
import type { SearchAddDestination, SearchPendingAction } from "@/components/SearchPreviewSheet";
import { useTmdbDiscoverSearch } from "@/components/tmdb-search/useTmdbDiscoverSearch";
import type { TitleKind } from "@/db";
import { titleMatchesKind } from "@/lib/catalog-filters";
import {
  diffListSelection,
  listSelectionToast,
  type SelectableList,
} from "@/lib/list-selection";
import type { TmdbCatalogResult } from "@/lib/tmdb";
import { showToast } from "@/lib/toast";
import type { UserTmdbEntry } from "@/lib/queries";
import { buildSearchHref } from "@/lib/search-session";
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
};

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
}: UseTmdbSearchAddArgs) => {
  const router = useRouter();
  const [catalog, setCatalog] = useState(() => toTmdbCatalogMap(existing));
  const [listIndex, setListIndex] = useState(memberships);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<SearchPendingAction | null>(null);
  const [preview, setPreviewState] = useState<TmdbCatalogResult | null>(null);
  const [listsError, setListsError] = useState<string | null>(null);
  const [kindFilter, setKindFilter] = useState<"ALL" | TitleKind>("ALL");
  const [isAdding, startAdd] = useTransition();

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

  const {
    query,
    results,
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
    onSettled: syncSearchUrl,
  });

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
    setPreviewState(next);
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
    handleSearch,
    handleQueryChange,
    handleAdd,
    handleOpen,
    handleSaveLists,
  };
};
