"use client";

import { useEffect } from "react";
import { describeKeyTarget, watchlistKeyAction } from "@/lib/watchlist-keys";

type UseWatchlistKeyboardArgs = {
  enabled: boolean;
  ids: readonly string[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onOpen: (id: string) => void;
  onMark: (id: string) => void;
};

/**
 * Desktop stage: ↑↓ move the selection, Enter opens the ficha, V marks it as seen. Focused
 * controls and open sheets keep their own keys (FIL-I41-15, `watchlistKeyAction`).
 */
export const useWatchlistKeyboard = ({
  enabled,
  ids,
  selectedId,
  onSelect,
  onOpen,
  onMark,
}: UseWatchlistKeyboardArgs) => {
  useEffect(() => {
    if (!enabled) {
      return;
    }
    const handle = (event: KeyboardEvent) => {
      const action = watchlistKeyAction(
        event.key,
        { meta: event.metaKey, ctrl: event.ctrlKey, alt: event.altKey },
        describeKeyTarget(event.target),
      );
      if (!action) {
        return;
      }
      const index = selectedId ? ids.indexOf(selectedId) : -1;
      if (action === "move") {
        if (ids.length === 0) {
          return;
        }
        event.preventDefault();
        const next = event.key === "ArrowDown" ? Math.min(ids.length - 1, index + 1) : Math.max(0, index - 1);
        const id = ids[next];
        if (id) {
          onSelect(id);
          document.querySelector(`[data-ficha="${id}"]`)?.scrollIntoView({ block: "nearest" });
        }
        return;
      }
      if (!selectedId) {
        return;
      }
      event.preventDefault();
      if (action === "open") {
        onOpen(selectedId);
      } else {
        onMark(selectedId);
      }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [enabled, ids, onMark, onOpen, onSelect, selectedId]);
};
