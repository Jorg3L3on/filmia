"use client";

import { useSyncExternalStore } from "react";

/** `false` on the server and during hydration; the live match afterwards. */
export const useMediaQuery = (query: string) =>
  useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );

export const DESKTOP_QUERY = "(min-width: 1024px)";
