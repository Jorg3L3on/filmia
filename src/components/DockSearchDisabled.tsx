"use client";

import { useEffect } from "react";
import { dockSearch } from "@/lib/dock-search";

/** While mounted (TMDB off), the dock's Buscar field is disabled (FIL-I22-7). Renders nothing. */
export const DockSearchDisabled = () => {
  useEffect(() => {
    dockSearch.setDisabled(true);
    return () => dockSearch.setDisabled(false);
  }, []);
  return null;
};
