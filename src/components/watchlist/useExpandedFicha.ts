"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import type { FichaView } from "@/components/watchlist/types";
import { createHistoryEntryStore, readHistoryEntry, writeHistoryEntry } from "@/lib/history-entry";

const EXPANDED_ENTRY = "watchlistExpanded";
const readExpandedEntry = () => readHistoryEntry(EXPANDED_ENTRY);

/**
 * Which ficha is unfolded. Back from a ficha reopens the row that was open: the id lives in
 * this history entry (read after hydration) until the user touches a row.
 */
export const useExpandedFicha = () => {
  const [store] = useState(() => createHistoryEntryStore(EXPANDED_ENTRY));
  const restoredId = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  const [touchedId, setExpandedId] = useState<string | null | undefined>(undefined);
  const expandedId = touchedId === undefined ? restoredId : touchedId;

  useEffect(() => {
    if (touchedId !== undefined) {
      writeHistoryEntry(EXPANDED_ENTRY, touchedId);
    }
  }, [touchedId]);

  const toggle = useCallback(
    (ficha: FichaView) =>
      setExpandedId((current) => {
        const open = current === undefined ? readExpandedEntry() : current;
        return open === ficha.id ? null : ficha.id;
      }),
    [],
  );
  const close = useCallback(() => setExpandedId(null), []);

  return { expandedId, toggle, close };
};
