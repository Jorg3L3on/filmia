"use client";

import { useEffect, useRef } from "react";
import { dockSearch } from "@/lib/dock-search";

type UseDockSearchBridgeArgs = {
  query: string;
  /** What the page opened with: words typed in the dock before the mount are taken over, these are not. */
  initialQuery: string;
  onQueryChange: (value: string) => void;
  onSubmit: () => void;
  /** With a person over a search (FIL-I22-6): where the dock's disc goes back to; null = the tab you came from. */
  backHref: string | null;
};

/**
 * Mobile: the field lives in the dock (DockSearchField). Mirror the query to it
 * and take its edits; words typed before the page mounted are picked up here.
 */
export const useDockSearchBridge = ({ query, initialQuery, onQueryChange, onSubmit, backHref }: UseDockSearchBridgeArgs) => {
  const handlers = useRef({ change: onQueryChange, submit: onSubmit });
  useEffect(() => {
    handlers.current = { change: onQueryChange, submit: onSubmit };
  });
  useEffect(() => {
    const pending = dockSearch.pendingQuery();
    const unregister = dockSearch.register({
      change: (value) => handlers.current.change(value),
      submit: () => handlers.current.submit(),
    });
    if (pending && pending !== initialQuery) {
      handlers.current.change(pending);
    }
    return unregister;
  }, [initialQuery]);
  useEffect(() => {
    dockSearch.syncFromPage(query);
  }, [query]);
  const backQuery = query.trim();
  useEffect(() => {
    dockSearch.setBack(backHref ? { href: backHref, query: backQuery } : null);
  }, [backHref, backQuery]);
};
