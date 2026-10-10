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
  /** A recommended card (not in the library): open its preview sheet. */
  onOpenReco: (title: CoverflowTitle) => void;
  /** «Vi esto» on a recommended card: log it as seen; resolves to an error message or null. */
  markRecoSeen: (title: CoverflowTitle) => Promise<string | null>;
};

const TonightContext = createContext<TonightHandlers | null>(null);

export const TonightProvider = TonightContext.Provider;

export const useTonight = () => useContext(TonightContext);
