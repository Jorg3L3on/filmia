"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { SEARCH_RECENTS_KEY, parseSearchRecents, pushSearchRecent } from "@/lib/search-recents";

const CHANGE_EVENT = "filmia:buscar-recientes";

const readRaw = () => {
  try {
    return window.localStorage.getItem(SEARCH_RECENTS_KEY);
  } catch {
    return null;
  }
};

const write = (value: string[]) => {
  try {
    if (value.length === 0) {
      window.localStorage.removeItem(SEARCH_RECENTS_KEY);
    } else {
      window.localStorage.setItem(SEARCH_RECENTS_KEY, JSON.stringify(value));
    }
  } catch {
    // Private mode / blocked storage: recents just don't stick.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
};

const subscribe = (onChange: () => void) => {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
};

/** This device's recent Buscar queries. The server renders none; the client fills them in after hydration. */
export const useSearchRecents = () => {
  // The raw string is the snapshot: stable between reads, so React does not loop.
  const raw = useSyncExternalStore(subscribe, readRaw, () => null);
  const recents = useMemo(() => parseSearchRecents(raw), [raw]);

  const remember = useCallback((query: string) => {
    write(pushSearchRecent(parseSearchRecents(readRaw()), query));
  }, []);

  const clear = useCallback(() => write([]), []);

  return { recents, remember, clear };
};
