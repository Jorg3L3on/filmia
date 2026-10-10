"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { addTitleFromTmdb } from "@/app/actions/titles";
import { pinTonightFromSearch } from "@/app/actions/tonight";
import type { SearchAddDestination, SearchPendingAction } from "@/components/SearchPreviewSheet";
import type { CoverflowTitle } from "@/components/coverflow/types";
import { pulseNav } from "@/lib/fly-to-nav";
import { recoResultOf } from "@/lib/tonight/reco-card";
import { showToast } from "@/lib/toast";

/** What we learn about a recommended film once the user acts on it during this visit. */
export type RecoLocal = { titleId: string; inWatchlist: boolean; watched: boolean };

const savedInFilmia = (name: string, created: boolean) =>
  created ? `${name} · se guarda en tu Filmia` : name;

/**
 * Acting on a recommended film from Hoy (FIL-I6-4). It has no `Title` until the user does
 * something with it, so every action goes through the same server paths as Buscar and the
 * sala learns the new `titleId` here.
 */
export const useRecoActions = () => {
  const router = useRouter();
  const [preview, setPreview] = useState<CoverflowTitle | null>(null);
  const [local, setLocal] = useState<Record<string, RecoLocal>>({});
  const [pending, setPending] = useState<{ id: string; action: SearchPendingAction } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tonightError, setTonightError] = useState<string | null>(null);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [justPinnedId, setJustPinnedId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const remember = useCallback((cardId: string, entry: RecoLocal) => {
    setLocal((current) => ({ ...current, [cardId]: entry }));
  }, []);

  const fromCard = (card: CoverflowTitle) => {
    const result = recoResultOf(card);
    if (!result) {
      throw new Error("Esta carta no es una recomendación.");
    }
    return result;
  };

  /** «Quiero ver» / «Vi esto» from the sheet or the card menu. */
  const add = useCallback(
    (card: CoverflowTitle, destination: SearchAddDestination) => {
      const result = fromCard(card);
      const previous = local[card.id];
      setError(null);
      setPending({ id: card.id, action: destination });
      startTransition(async () => {
        const outcome = await addTitleFromTmdb({
          tmdbId: result.tmdbId,
          kind: result.kind,
          name: result.name,
          originalName: result.originalName,
          year: result.year,
          posterPath: result.posterPath,
          destination,
          addToWatchlist: destination === "watchlist",
        });
        setPending(null);
        if (!outcome.ok) {
          setError(outcome.error);
          showToast({ title: "No se pudo guardar", description: outcome.error, variant: "error" });
          return;
        }
        remember(card.id, {
          titleId: outcome.titleId,
          inWatchlist: outcome.addedToWatchlist || destination === "watchlist" || Boolean(previous?.inWatchlist),
          watched: outcome.markedWatched || destination === "watched",
        });
        showToast(
          destination === "watchlist"
            ? { title: "En Quiero ver", description: savedInFilmia(result.name, outcome.created) }
            : { title: "Marcada como vista", description: savedInFilmia(result.name, outcome.created) },
        );
      });
    },
    [local, remember],
  );

  /** «Ver esta noche»: into Quiero ver if needed, then first in Para ti. */
  const pin = useCallback(
    (card: CoverflowTitle) => {
      const result = fromCard(card);
      setTonightError(null);
      setPending({ id: card.id, action: "tonight" });
      startTransition(async () => {
        const outcome = await pinTonightFromSearch({
          tmdbId: result.tmdbId,
          kind: result.kind,
          name: result.name,
          originalName: result.originalName,
          year: result.year,
          posterPath: result.posterPath,
        });
        setPending(null);
        if (!outcome.ok) {
          setTonightError(outcome.error);
          return;
        }
        remember(card.id, { titleId: outcome.titleId, inWatchlist: true, watched: false });
        setPinnedId(card.id);
        setJustPinnedId(card.id);
        pulseNav("today");
        showToast({
          title: "Primera en Hoy esta noche",
          description: savedInFilmia(result.name, outcome.created),
          durationMs: 6000,
        });
      });
    },
    [remember],
  );

  /** «Ficha»: the title is created on the way, like opening a result in Buscar. */
  const openFicha = useCallback(
    (card: CoverflowTitle) => {
      const known = local[card.id];
      if (known) {
        router.push(`/titulos/${known.titleId}`);
        return;
      }
      const result = fromCard(card);
      setError(null);
      setPending({ id: card.id, action: "open" });
      startTransition(async () => {
        const outcome = await addTitleFromTmdb({
          tmdbId: result.tmdbId,
          kind: result.kind,
          name: result.name,
          originalName: result.originalName,
          year: result.year,
          posterPath: result.posterPath,
        });
        setPending(null);
        if (!outcome.ok) {
          setError(outcome.error);
          return;
        }
        remember(card.id, {
          titleId: outcome.titleId,
          inWatchlist: outcome.addedToWatchlist,
          watched: outcome.markedWatched,
        });
        router.push(`/titulos/${outcome.titleId}`);
      });
    },
    [local, remember, router],
  );

  /** «Vi esto» torn from the stub: logs it as seen today; resolves to an error message or null. */
  const markSeen = useCallback(
    async (card: CoverflowTitle): Promise<string | null> => {
      const result = fromCard(card);
      const outcome = await addTitleFromTmdb({
        tmdbId: result.tmdbId,
        kind: result.kind,
        name: result.name,
        originalName: result.originalName,
        year: result.year,
        posterPath: result.posterPath,
        destination: "watched",
      });
      if (!outcome.ok) {
        return outcome.error;
      }
      remember(card.id, { titleId: outcome.titleId, inWatchlist: false, watched: true });
      return null;
    },
    [remember],
  );

  const closePreview = useCallback(() => {
    setPreview(null);
    setError(null);
    setTonightError(null);
  }, []);

  return {
    preview,
    openPreview: (card: CoverflowTitle) => setPreview(card),
    closePreview,
    local,
    pending,
    error,
    tonightError,
    pinnedId,
    justPinnedId,
    add,
    pin,
    openFicha,
    markSeen,
    titleIdOf: (cardId: string) => local[cardId]?.titleId ?? null,
    isSaved: (cardId: string) => Boolean(local[cardId]?.inWatchlist),
  };
};

export type RecoActions = ReturnType<typeof useRecoActions>;
