"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveTmdbTitleInLists } from "@/app/actions/lists";
import { addTitleFromTmdb } from "@/app/actions/titles";
import { pinTonightFromSearch } from "@/app/actions/tonight";
import type { SearchAddDestination, SearchPendingAction } from "@/components/tmdb-search/search-actions";
import { pulseNav } from "@/lib/fly-to-nav";
import {
  diffListSelection,
  listSelectionToast,
  type SelectableList,
} from "@/lib/list-selection";
import type { UserTmdbEntry } from "@/lib/queries";
import type { TmdbCatalogResult } from "@/lib/tmdb";
import { showToast } from "@/lib/toast";
import { PARA_TI_SLUG } from "@/lib/tonight/select";
import { TONIGHT_LENS_PARAM } from "@/lib/tonight/serve";
import {
  lookupTmdbCatalogEntry,
  tmdbCatalogKey,
  toTmdbCatalogMap,
} from "@/lib/tmdb-search-catalog";

/** «Ver en Hoy»: Para ti, where the pinned card leads. */
const TONIGHT_PIN_HREF = `/?${TONIGHT_LENS_PARAM}=${PARA_TI_SLUG}`;

/** A title new to the user's catalog says where it went (#104 ítem 9). */
const savedInFilmiaCopy = (name: string, created: boolean) =>
  created ? `${name} · se guarda en tu Filmia` : name;

export type UseTmdbTitleActionsArgs = {
  existing: UserTmdbEntry[];
  /** «Vi esto» logs on this day (Diario mode); null = today. */
  watchedDate?: string | null;
  /** Every list of the user (diarias + propias), for «Agregar a lista». */
  lists?: SelectableList[];
  /** titleId → list ids, so the picker starts on what is already saved. */
  memberships?: Record<string, string[]>;
  /** Title pinned for tonight when the page loaded («Ver esta noche»). */
  pinnedTitleId?: string | null;
  /** Buscar shows a failed save inline too. */
  onError?: (message: string | null) => void;
};

/**
 * What a TMDB film can have done to it without opening its ficha — Quiero ver, Vi esto,
 * Ver esta noche, Agregar a lista — with the optimistic «where it lives in your Filmia» state.
 * Buscar's results and Cine's posters share it (FIL-I8, FIL-I17-4).
 */
export const useTmdbTitleActions = ({
  existing,
  watchedDate = null,
  lists = [],
  memberships = {},
  pinnedTitleId: initialPinnedTitleId = null,
  onError,
}: UseTmdbTitleActionsArgs) => {
  const router = useRouter();
  const [catalog, setCatalog] = useState(() => toTmdbCatalogMap(existing));
  const [listIndex, setListIndex] = useState(memberships);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<SearchPendingAction | null>(null);
  const [listsError, setListsError] = useState<string | null>(null);
  const [pinnedTitleId, setPinnedTitleId] = useState(initialPinnedTitleId);
  /** Result key pinned during this visit: only a fresh pin gets the moon pop. */
  const [justPinnedKey, setJustPinnedKey] = useState<string | null>(null);
  const [tonightError, setTonightError] = useState<string | null>(null);
  const [isAdding, startAdd] = useTransition();

  /** The lists a result is already in, so «Agregar a lista» starts from them. */
  const listIdsFor = (result: TmdbCatalogResult) => {
    const local = lookupTmdbCatalogEntry(catalog, result.tmdbId, result.kind);
    if (!local || local.titleId.startsWith("pending:")) {
      return [];
    }
    return listIndex[local.titleId] ?? [];
  };

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
    onError?.(null);
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
        onError?.(outcome.error);
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


  /**
   * «Ver esta noche»: into Quiero ver if needed, then first in Para ti. The
   * toast confirms and offers Hoy instead of navigating.
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
        showToast({ title: "No se pudo reservar", description: outcome.error, variant: "error" });
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

  return {
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
  };
};
