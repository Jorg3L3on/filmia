"use client";

import { useMemo, useState } from "react";
import type { CoverflowTitle } from "@/components/coverflow/types";

export const useCoverflowLocalTitles = (incomingTitles: CoverflowTitle[]) => {
  const [hiddenIds, setHiddenIds] = useState<ReadonlySet<string>>(() => new Set());
  const [watchedIds, setWatchedIds] = useState<ReadonlySet<string>>(() => new Set());

  const titles = useMemo(
    () =>
      incomingTitles
        .filter((title) => !hiddenIds.has(title.id))
        .map((title) =>
          watchedIds.has(title.id) ? { ...title, watched: true } : title,
        ),
    [hiddenIds, incomingTitles, watchedIds],
  );

  const handleHide = (titleId: string) => {
    setHiddenIds((current) => new Set(current).add(titleId));
  };

  const handleRestore = (titleId: string) => {
    setHiddenIds((current) => {
      const next = new Set(current);
      next.delete(titleId);
      return next;
    });
  };

  const handleMarkedSeen = (titleId: string) => {
    setWatchedIds((current) => new Set(current).add(titleId));
  };

  const handleMarkSeenError = (titleId: string) => {
    setWatchedIds((current) => {
      const next = new Set(current);
      next.delete(titleId);
      return next;
    });
  };

  return {
    titles,
    handleHide,
    handleRestore,
    handleMarkedSeen,
    handleMarkSeenError,
  };
};
