import { and, eq, gte, inArray } from "drizzle-orm";
import { db, pickEvents, tonightPicks } from "@/db";
import { PARA_TI_SLUG } from "@/lib/tonight/select";
import { findPinnedTitleId } from "@/lib/tonight/pin";
import { NOT_TONIGHT_DAYS } from "@/lib/tonight/score";
import type { TonightEvent, TonightReason } from "@/lib/tonight/types";
import { isPickEventKind, parseReasons } from "@/lib/tonight-store";
import type { WatchlistSignals } from "@/lib/watchlist-ficha";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * What Quiero ver borrows from Hoy, in two queries: the engine's reasons per
 * queued title, live «Ahora no» snoozes and tonight's pin.
 */
export const loadWatchlistSignals = async (
  userId: string,
  now: Date,
): Promise<WatchlistSignals> => {
  const since = new Date(now.getTime() - NOT_TONIGHT_DAYS * DAY_MS);
  const [picks, rows] = await Promise.all([
    db.query.tonightPicks.findMany({
      where: eq(tonightPicks.userId, userId),
      columns: { titleId: true, lens: true, reasons: true },
    }),
    db.query.pickEvents.findMany({
      where: and(
        eq(pickEvents.userId, userId),
        gte(pickEvents.createdAt, since),
        inArray(pickEvents.kind, ["not_tonight", "pinned"]),
      ),
      columns: { titleId: true, kind: true, createdAt: true },
    }),
  ]);

  const reasonsByTitle = new Map<string, TonightReason[]>();
  for (const pick of picks) {
    const current = reasonsByTitle.get(pick.titleId);
    if (!current || pick.lens === PARA_TI_SLUG) {
      reasonsByTitle.set(pick.titleId, parseReasons(pick.reasons));
    }
  }

  const events: TonightEvent[] = rows.flatMap((row) =>
    isPickEventKind(row.kind)
      ? [{ titleId: row.titleId, kind: row.kind, createdAt: row.createdAt }]
      : [],
  );

  const snoozedUntilByTitle = new Map<string, Date>();
  for (const event of events) {
    if (event.kind !== "not_tonight") {
      continue;
    }
    const until = new Date(event.createdAt.getTime() + NOT_TONIGHT_DAYS * DAY_MS);
    const current = snoozedUntilByTitle.get(event.titleId);
    if (until.getTime() > now.getTime() && (!current || until > current)) {
      snoozedUntilByTitle.set(event.titleId, until);
    }
  }

  return {
    reasonsByTitle,
    snoozedUntilByTitle,
    pinnedTitleId: findPinnedTitleId(events, now),
  };
};
