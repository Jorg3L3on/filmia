"use client";

import { createContext, useContext } from "react";
import type { CoverflowTitle } from "@/components/coverflow/types";
import type { DayPart } from "@/lib/tonight";

/** Sala-level handlers the deck cards reach without prop drilling. */
export type TonightHandlers = {
  lens: string;
  /** Viewer's part of the day; the clock copy (acaba / se pasa) only shows at night. */
  dayPart: DayPart;
  onWhy: (title: CoverflowTitle) => void;
  onOpenMenu: (title: CoverflowTitle) => void;
  /** Card finished its stamp + flight: remove from the deck and offer Deshacer. */
  onWatched: (title: CoverflowTitle) => void;
  onWatchError: (title: CoverflowTitle, message: string) => void;
  onOpened: (title: CoverflowTitle) => void;
};

const TonightContext = createContext<TonightHandlers | null>(null);

export const TonightProvider = TonightContext.Provider;

export const useTonight = () => useContext(TonightContext);
