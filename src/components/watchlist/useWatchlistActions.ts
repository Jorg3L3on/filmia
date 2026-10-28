"use client";

import { moveListItem, reorderList } from "@/app/actions/lists";
import { markNotTonight, pinTonight } from "@/app/actions/tonight";
import {
  moveWatchlistItemToTop,
  removeFromWatchlist,
  undoMarkWatched,
  updateWatchlistNote,
} from "@/app/actions/watchlist";
import type { FichaView } from "@/components/watchlist/types";
import { flyPosterToProfile, pulseNav } from "@/lib/fly-to-nav";
import { tmdbPosterUrl } from "@/lib/tmdb";
import { reportPickFailure, startWatchedUndo } from "@/lib/alert-retry";
import { showToast } from "@/lib/toast";
import { retryAfterRevert, showActionError, TOAST_COPY, toastPoster } from "@/lib/toast-alerts";
import { NOT_TONIGHT_DAYS } from "@/lib/tonight/score";
import { swapAdjacentIds } from "@/lib/use-optimistic-action";
import { showDiaryToast } from "@/lib/quick-rate-toast";

/** The VISTO stamp shows this long before the poster flies to Perfil (same as the deck). */
export const STAMP_MS = 520;

type UseWatchlistActionsArgs = {
  listId: string;
  order: string[];
  visibleIds: string[];
  hiddenInOrder: string[];
  run: (next: string[], action: () => Promise<unknown>) => void;
  hide: (id: string) => void;
  restore: (id: string) => void;
  setStampedId: (id: string | null) => void;
  setPinnedId: (id: string | null) => void;
  setSnoozedUntil: (id: string, until: Date | null) => void;
  setNote: (id: string, note: string | null) => void;
  later: (fn: () => void, ms: number) => void;
};

const posterElement = (id: string) =>
  document.querySelector<HTMLElement>(`[data-ficha-poster="${id}"]`);

/** Every mutation of the cartelera, with its optimistic update and toast. */
export const useWatchlistActions = ({
  listId,
  order,
  visibleIds,
  hiddenInOrder,
  run,
  hide,
  restore,
  setStampedId,
  setPinnedId,
  setSnoozedUntil,
  setNote,
  later,
}: UseWatchlistActionsArgs) => {
  const remove = (ficha: FichaView) => {
    hide(ficha.id);
    showToast({
      title: TOAST_COPY.removedWatchlist,
      description: ficha.name,
      poster: toastPoster(ficha.posterPath),
    });
    run(
      order.filter((id) => id !== ficha.id),
      async () => {
        try {
          await removeFromWatchlist(ficha.id);
        } catch (caught) {
          restore(ficha.id);
          throw caught;
        }
      },
    );
  };

  /** `MarkWatchedSheet` already saved: stamp, fly to Perfil, offer Deshacer. */
  const onWatchedSaved = (ficha: FichaView, rating: number | null) => {
    setStampedId(ficha.id);
    later(() => {
      setStampedId(null);
      hide(ficha.id);
      void flyPosterToProfile(posterElement(ficha.id), tmdbPosterUrl(ficha.posterPath, "w185"));
      const poster = toastPoster(ficha.posterPath);
      showDiaryToast({
        titleId: ficha.id,
        description: ficha.name,
        poster,
        rated: rating != null,
        onUndo: () => {
          startWatchedUndo({
            apply: () => restore(ficha.id),
            revert: () => hide(ficha.id),
            undo: () => undoMarkWatched(ficha.id),
            poster,
            description: ficha.name,
          });
        },
      });
    }, STAMP_MS);
  };

  const onWatchedError = (ficha: FichaView) => {
    setStampedId(null);
    restore(ficha.id);
  };

  const notTonight = (ficha: FichaView) => {
    const until = new Date(Date.now() + NOT_TONIGHT_DAYS * 24 * 60 * 60 * 1000);
    const poster = toastPoster(ficha.posterPath);
    setSnoozedUntil(ficha.id, until);
    showToast({
      title: TOAST_COPY.notTonight,
      description: `${ficha.name} vuelve a Hoy en dos semanas.`,
      poster,
    });
    void markNotTonight(ficha.id, "quiero-ver").catch(() => {
      setSnoozedUntil(ficha.id, null);
      reportPickFailure(poster);
    });
  };

  const tonight = (ficha: FichaView) => {
    const poster = toastPoster(ficha.posterPath);
    if (ficha.pinned) {
      showToast({ title: TOAST_COPY.choiceConfirmed, description: ficha.name, poster });
      return;
    }
    setPinnedId(ficha.id);
    showToast({
      title: TOAST_COPY.reservedTonight,
      description: `${ficha.name} aparece primera en Hoy.`,
      poster,
    });
    pulseNav("today");
    void pinTonight(ficha.id).catch(() => {
      setPinnedId(null);
      reportPickFailure(poster);
    });
  };

  const moveToTop = (ficha: FichaView) => {
    if (visibleIds[0] === ficha.id) {
      return;
    }
    const nextVisible = [ficha.id, ...visibleIds.filter((id) => id !== ficha.id)];
    showToast({
      title: TOAST_COPY.movedFirst,
      description: ficha.name,
      poster: toastPoster(ficha.posterPath),
    });
    run([...nextVisible, ...hiddenInOrder], () => moveWatchlistItemToTop(ficha.id));
  };

  const saveNote = (ficha: FichaView, note: string) => {
    const next = note.trim() || null;
    setNote(ficha.id, next);
    const formData = new FormData();
    formData.set("queueNote", next ?? "");
    const poster = toastPoster(ficha.posterPath);
    showToast({
      title: next ? TOAST_COPY.noteSaved : TOAST_COPY.noteRemoved,
      description: ficha.name,
      poster,
    });
    void updateWatchlistNote(ficha.id, formData).catch(() => {
      setNote(ficha.id, ficha.queueNote);
      showActionError({
        title: TOAST_COPY.couldNotSave,
        description: "No se pudo guardar la nota.",
        poster,
        retry: () =>
          retryAfterRevert(
            () => setNote(ficha.id, next),
            () => setNote(ficha.id, ficha.queueNote),
            async () => {
              await updateWatchlistNote(ficha.id, formData);
              showToast({
                title: next ? TOAST_COPY.noteSaved : TOAST_COPY.noteRemoved,
                description: ficha.name,
                poster,
              });
            },
          ),
      });
    });
  };

  const move = (titleId: string, direction: "up" | "down") => {
    const nextVisible = swapAdjacentIds(visibleIds, titleId, direction);
    const index = visibleIds.indexOf(titleId);
    const neighbor = visibleIds[direction === "up" ? index - 1 : index + 1];
    run([...nextVisible, ...hiddenInOrder], () => moveListItem(listId, titleId, direction, neighbor));
  };

  const reorder = (nextVisible: string[]) => {
    run([...nextVisible, ...hiddenInOrder], () => reorderList(listId, nextVisible));
  };

  return { remove, onWatchedSaved, onWatchedError, notTonight, tonight, moveToTop, saveNote, move, reorder };
};
