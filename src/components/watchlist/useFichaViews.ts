"use client";

import { useMemo } from "react";
import type { FichaView } from "@/components/watchlist/types";
import { PINNED_REASON } from "@/lib/tonight/pin";
import { fitForRuntime, remainingMinutes } from "@/lib/tonight/time";
import type { NightEnds } from "@/lib/tonight/types";
import type { WatchlistFicha } from "@/lib/watchlist-ficha";
import { chooseHook } from "@/lib/watchlist-hook";

type UseFichaViewsArgs = {
  order: readonly string[];
  byId: ReadonlyMap<string, WatchlistFicha>;
  hiddenIds: ReadonlySet<string>;
  /** `null` until hydration: no fit, no «te cabe» line. */
  now: Date | null;
  nightEnds: NightEnds;
  /** Optimistic overrides from this session. */
  notes: ReadonlyMap<string, string | null>;
  snoozed: ReadonlyMap<string, Date>;
  pinnedId: string | null;
};

/** Rows with the clock applied (hook + fit), in the optimistic order, minus hidden ones. */
export const useFichaViews = ({
  order,
  byId,
  hiddenIds,
  now,
  nightEnds,
  notes,
  snoozed,
  pinnedId,
}: UseFichaViewsArgs): FichaView[] =>
  useMemo(() => {
    const remaining = now ? remainingMinutes(now, nightEnds) : null;
    const clock = now ?? new Date(0);
    return order.flatMap((id) => {
      const row = byId.get(id);
      if (!row || hiddenIds.has(id)) {
        return [];
      }
      const fit = now && remaining != null ? fitForRuntime(row.runtimeMinutes, remaining, now) : null;
      const queueNote = notes.has(id) ? (notes.get(id) ?? null) : row.queueNote;
      const snoozedUntil = snoozed.get(id) ?? (row.snoozedUntil ? new Date(row.snoozedUntil) : null);
      const pinned = pinnedId === id;
      const reasons =
        pinned && !row.reasons.some((reason) => reason.kind === "pinned")
          ? [PINNED_REASON, ...row.reasons]
          : row.reasons;
      const hook = chooseHook({
        reasons,
        fit,
        queueNote,
        kind: row.kind,
        runtimeMinutes: row.runtimeMinutes,
        snoozedUntil,
        now: clock,
      });
      const view: FichaView = { ...row, queueNote, hook, fit, pinned };
      return [view];
    });
  }, [byId, hiddenIds, nightEnds, notes, now, order, pinnedId, snoozed]);
