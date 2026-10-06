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
import { showToast } from "@/lib/toast";
import { NOT_TONIGHT_DAYS } from "@/lib/tonight/score";
import { swapAdjacentIds } from "@/lib/use-optimistic-action";

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
    showToast({ title: "Fuera de Quiero ver", description: ficha.name });
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
  const onWatchedSaved = (ficha: FichaView) => {
    setStampedId(ficha.id);
    later(() => {
      setStampedId(null);
      hide(ficha.id);
      void flyPosterToProfile(posterElement(ficha.id), tmdbPosterUrl(ficha.posterPath, "w185"));
      showToast({
        title: "En tu diario",
        description: ficha.name,
        durationMs: 6000,
        action: {
          label: "Deshacer",
          onClick: () => {
            restore(ficha.id);
            void undoMarkWatched(ficha.id).catch(() => {
              showToast({ title: "No se pudo deshacer", variant: "error" });
            });
          },
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
    setSnoozedUntil(ficha.id, until);
    showToast({ title: "Ahora no", description: `${ficha.name} vuelve a Hoy en dos semanas.` });
    void markNotTonight(ficha.id, "quiero-ver").catch(() => {
      setSnoozedUntil(ficha.id, null);
      showToast({ title: "No se pudo guardar", variant: "error" });
    });
  };

  const tonight = (ficha: FichaView) => {
    if (ficha.pinned) {
      showToast({ title: "Ya es tu elección de esta noche", description: ficha.name });
      return;
    }
    setPinnedId(ficha.id);
    showToast({ title: "Lista para esta noche", description: `${ficha.name} aparece primera en Hoy.` });
    pulseNav("today");
    void pinTonight(ficha.id).catch(() => {
      setPinnedId(null);
      showToast({ title: "No se pudo guardar", variant: "error" });
    });
  };

  const moveToTop = (ficha: FichaView) => {
    if (visibleIds[0] === ficha.id) {
      return;
    }
    const nextVisible = [ficha.id, ...visibleIds.filter((id) => id !== ficha.id)];
    showToast({ title: "Ahora es la primera", description: ficha.name });
    run([...nextVisible, ...hiddenInOrder], () => moveWatchlistItemToTop(ficha.id));
  };

  const saveNote = (ficha: FichaView, note: string) => {
    const next = note.trim() || null;
    setNote(ficha.id, next);
    const formData = new FormData();
    formData.set("queueNote", next ?? "");
    showToast({ title: next ? "Nota guardada" : "Nota quitada", description: ficha.name });
    void updateWatchlistNote(ficha.id, formData).catch(() => {
      setNote(ficha.id, ficha.queueNote);
      showToast({ title: "No se pudo guardar la nota", variant: "error" });
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
