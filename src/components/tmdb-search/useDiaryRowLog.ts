"use client";

import { useState } from "react";
import type { SearchPendingAction } from "@/components/tmdb-search/search-actions";
import type { SearchRowLog, SearchRowStatus } from "@/components/tmdb-search/SearchResultRow";
import type { TmdbCatalogResult } from "@/lib/tmdb";
import { tmdbCatalogKey } from "@/lib/tmdb-search-catalog";

type UseDiaryRowLogArgs = {
  /** Diario mode is on (`?fecha=` / `?destino=visto`). */
  enabled: boolean;
  /** The day being logged; null = today. */
  date: string | null;
  pendingKey: string | null;
  pendingAction: SearchPendingAction | null;
  statusOf: (result: TmdbCatalogResult) => SearchRowStatus;
  /** Writes the viewing (handleAdd(result, "watched")). */
  onLog: (result: TmdbCatalogResult) => void;
};

/**
 * Diario mode (FIL-I22-3): what each row's check does and says. The rows logged
 * during this visit read «Registrada · día»; a failed write takes the pill away
 * with the optimistic status.
 */
export const useDiaryRowLog = ({ enabled, date, pendingKey, pendingAction, statusOf, onLog }: UseDiaryRowLogArgs) => {
  const [loggedKeys, setLoggedKeys] = useState<ReadonlySet<string>>(() => new Set());
  return (result: TmdbCatalogResult): SearchRowLog | null => {
    if (!enabled) {
      return null;
    }
    const key = tmdbCatalogKey(result.tmdbId, result.kind);
    return {
      date,
      logged: loggedKeys.has(key) && statusOf(result) === "watched",
      pending: pendingKey === key && pendingAction === "watched",
      onLog: () => {
        setLoggedKeys((current) => new Set([...current, key]));
        onLog(result);
      },
    };
  };
};
