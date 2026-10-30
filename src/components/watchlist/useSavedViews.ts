"use client";

import { useCallback, useState, useTransition } from "react";
import {
  deleteWatchlistView,
  pinWatchlistView,
  saveWatchlistView,
  updateWatchlistView,
} from "@/app/actions/watchlist-views";
import { showToast } from "@/lib/toast";
import type { SavedView, SavedViewsResult } from "@/lib/watchlist-views";

/**
 * Vistas guardadas (FIL-I34-6) on the client: the list comes with the page, and every write
 * answers with the new list. Errors show as a toast; `save` also hands its error back so the
 * sheet can keep the name the person typed.
 */
export const useSavedViews = (initial: SavedView[]) => {
  const [views, setViews] = useState(initial);
  const [pending, startTransition] = useTransition();

  const run = useCallback(
    (action: () => Promise<SavedViewsResult>, done?: (result: SavedViewsResult) => void, quiet = false) =>
      startTransition(async () => {
        let result: SavedViewsResult;
        try {
          result = await action();
        } catch {
          result = { ok: false, error: "No pudimos guardar la vista. Revisa tu conexión." };
        }
        if (result.ok) {
          setViews(result.views);
        } else if (!quiet) {
          showToast({ title: result.error, variant: "error" });
        }
        done?.(result);
      }),
    [],
  );

  return {
    views,
    pending,
    save: (name: string, query: string, pin: boolean, done: (result: SavedViewsResult) => void) =>
      run(() => saveWatchlistView(name, query, pin), done, true),
    update: (id: string, query: string) =>
      run(
        () => updateWatchlistView(id, query),
        (result) => {
          if (result.ok) showToast({ title: "Vista actualizada" });
        },
      ),
    pin: (id: string, pinned: boolean) => run(() => pinWatchlistView(id, pinned)),
    remove: (id: string) => run(() => deleteWatchlistView(id)),
  };
};

export type SavedViewsApi = ReturnType<typeof useSavedViews>;
