"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { CheckIcon, ReorderIcon } from "@/components/watchlist/icons";
import { cn } from "@/lib/cn";
import { glassIconClass } from "@/lib/ui";

type WatchlistEditing = {
  isEditing: boolean;
  setIsEditing: (next: boolean | ((current: boolean) => boolean)) => void;
  canReorder: boolean;
};

const WatchlistEditingContext = createContext<WatchlistEditing | null>(null);

/**
 * Reorder mode shared between the compact header's round «Reordenar» button (FIL-I21-7)
 * and the cartelera, which owns the list. `canReorder` comes from the page: manual order
 * and at least two titles.
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

/** Round glass button in the phone header: toggles reorder mode; hidden when the list cannot be reordered. */
export const WatchlistReorderButton = () => {
  const editing = useWatchlistEditing();
  if (!editing || !editing.canReorder) {
    return null;
  }
  return (
    <button
      type="button"
      aria-label={editing.isEditing ? "Terminar de reordenar" : "Reordenar la lista"}
      aria-pressed={editing.isEditing}
      onClick={() => editing.setIsEditing((current) => !current)}
      className={cn(glassIconClass, "size-8 before:absolute before:-inset-1.5 before:content-['']", editing.isEditing && "border-accent/60 bg-accent/20 text-accent")}
    >
      {editing.isEditing ? <CheckIcon size={18} /> : <ReorderIcon size={18} />}
    </button>
  );
};
