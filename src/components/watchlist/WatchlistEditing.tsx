"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

type WatchlistEditing = {
  isEditing: boolean;
  setIsEditing: (next: boolean | ((current: boolean) => boolean)) => void;
  canReorder: boolean;
};

const WatchlistEditingContext = createContext<WatchlistEditing | null>(null);

/**
 * Reorder mode shared between the header (Reordenar in the summary line and the Ordenar sheet,
 * FIL-I34-3) and the cartelera, which owns the list. `canReorder`: at least two titles.
 */
export const WatchlistEditingProvider = ({ canReorder, children }: { canReorder: boolean; children: ReactNode }) => {
  const [isEditing, setIsEditing] = useState(false);
  return (
    <WatchlistEditingContext.Provider value={{ isEditing, setIsEditing, canReorder }}>
      {children}
    </WatchlistEditingContext.Provider>
  );
};

export const useWatchlistEditing = () => useContext(WatchlistEditingContext);
