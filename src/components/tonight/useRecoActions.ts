"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { addTitleFromTmdb } from "@/app/actions/titles";
import { pinTonightFromSearch } from "@/app/actions/tonight";
import type { SearchAddDestination, SearchPendingAction } from "@/components/tmdb-search/search-actions";
import type { CoverflowTitle } from "@/components/coverflow/types";
import { handoffKey, readFichaHandoffs } from "@/lib/ficha-handoff";
import { pulseNav } from "@/lib/fly-to-nav";
import { previewFichaHref } from "@/lib/title-preview";
import { recoResultOf } from "@/lib/tonight/reco-card";
import { showToast } from "@/lib/toast";

/** What we learn about a recommended film once the user acts on it during this visit. */
export type RecoLocal = {
  titleId: string;
  inWatchlist: boolean;
  watched: boolean;
  /** Learned from a ficha preview on Back (FIL-I8), not from an action in the sala. */
  fromFicha?: boolean;
};

const savedInFilmia = (name: string, created: boolean) =>
  created ? `${name} · se guarda en tu Filmia` : name;

/**
 * Acting on a recommended film from Hoy (FIL-I6-4). It has no `Title` until the user does
 * something with it, so every action goes through the same server paths as Buscar and the
 * sala learns the new `titleId` here.
 */
export const useRecoActions = () => {
  const [local, setLocal] = useState<Record<string, RecoLocal>>({});
  // Handlers handed to long animations (the stub's flight) keep an old render's closure: read the
  // latest entries from a ref, or «Deshacer» would look for the title under the catalog id.
  const localRef = useRef<Record<string, RecoLocal>>({});
  const [pending, setPending] = useState<{ id: string; action: SearchPendingAction } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [justPinnedId, setJustPinnedId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const remember = useCallback((cardId: string, entry: RecoLocal) => {
    localRef.current = { ...localRef.current, [cardId]: entry };
    setLocal(localRef.current);
  }, []);

  const fromCard = (card: CoverflowTitle) => {
    const result = recoResultOf(card);
    if (!result) {
      throw new Error("Esta carta no es una recomendación.");
    }
    return result;
  };

  /** «Quiero ver» / «Vi esto» from the card menu. */
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
          showToast({ title: "No se pudo reservar", description: outcome.error, variant: "error" });
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

  /**
   * The card's ficha (FIL-I8): the user's own once they acted on it, else the
   * preview by TMDB, which creates nothing until an action there.
   */
  const hrefOf = useCallback(
    (card: CoverflowTitle) => {
      const known = localRef.current[card.id];
      if (known) {
        return `/titulos/${known.titleId}`;
      }
      const reco = card.tonight?.reco;
      return reco ? previewFichaHref(card.kind, reco.tmdbId) : `/titulos/${card.id}`;
    },
    [],
  );

  /**
   * Back from a ficha preview that saved one of these films: adopt what it
   * learned so the card says «Ya está en Quiero ver» (or leaves the deck, if seen).
   */
  const adoptFromFichas = useCallback(
    (cards: readonly CoverflowTitle[]) => {
      const handoffs = readFichaHandoffs();
      for (const card of cards) {
        const reco = card.tonight?.reco;
        const entry = reco ? handoffs[handoffKey(card.kind, reco.tmdbId)] : undefined;
        if (!entry || localRef.current[card.id]) {
          continue;
        }
        remember(card.id, {
          titleId: entry.titleId,
          inWatchlist: entry.inWatchlist,
          watched: entry.watched,
          fromFicha: true,
        });
      }
    },
    [remember],
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

  return {
    local,
    pending,
    error,
    pinnedId,
    justPinnedId,
    add,
    pin,
    hrefOf,
    adoptFromFichas,
    markSeen,
    titleIdOf: (cardId: string) => localRef.current[cardId]?.titleId ?? null,
    isSaved: (cardId: string) => Boolean(local[cardId]?.inWatchlist),
  };
};

export type RecoActions = ReturnType<typeof useRecoActions>;
