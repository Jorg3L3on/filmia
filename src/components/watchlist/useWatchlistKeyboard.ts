"use client";

import { useEffect } from "react";

type UseWatchlistKeyboardArgs = {
  enabled: boolean;
  ids: readonly string[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onOpen: (id: string) => void;
  onMark: (id: string) => void;
};

const isEditable = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  );
};

/** Desktop stage: ↑↓ move the selection, Enter opens the ficha, V marks it as seen. */
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
      if (event.metaKey || event.ctrlKey || event.altKey || isEditable(event.target)) {
        return;
      }
      const index = selectedId ? ids.indexOf(selectedId) : -1;
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
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
      if (event.key === "Enter") {
        event.preventDefault();
        onOpen(selectedId);
      } else if (event.key === "v" || event.key === "V") {
        event.preventDefault();
        onMark(selectedId);
      }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [enabled, ids, onMark, onOpen, onSelect, selectedId]);
};
