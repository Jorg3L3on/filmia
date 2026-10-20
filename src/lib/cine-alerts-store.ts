import { and, eq, exists, gte, inArray, lte, ne, sql } from "drizzle-orm";
import { catalog, cinemaAlerts, cinemaReleases, db, listItems, lists, pushSubscriptions, titles } from "@/db";
import {
  CINEMA_ALERT_WINDOW_DAYS,
  cinemaPayloadsForUser,
  selectCinemaArrivals,
  type CinemaArrival,
} from "@/lib/cine-alerts";
import { addDays, mxToday } from "@/lib/cine-core";
import { WATCHLIST_SLUG } from "@/lib/lists";
import { isPushConfigured, sendPush, type PushSendOutcome } from "@/lib/push/web-push";
import { runPool } from "@/lib/run-pool";

const SEND_CONCURRENCY = 5;

export type CinemaAlertsSummary = {
  skipped?: "push_not_configured";
  candidates: number;
  arrivals: number;
  users: number;
  sent: number;
  gone: number;
  failed: number;
};

/** Quiero ver entries of subscribed users whose film opens in MX theaters within the window. */
const loadCandidates = async (today: string) =>
  db
    .select({
      userId: titles.userId,
      titleId: titles.id,
      catalogId: catalog.id,
      name: catalog.name,
      mxReleaseDate: cinemaReleases.mxReleaseDate,
      status: cinemaReleases.status,
      watched: sql<boolean>`${titles.watchedAt} IS NOT NULL`,
      alerted: sql<boolean>`EXISTS (
        SELECT 1 FROM ${cinemaAlerts}
        WHERE ${cinemaAlerts.userId} = ${titles.userId}
          AND ${cinemaAlerts.catalogId} = ${catalog.id}
          AND ${cinemaAlerts.mxReleaseDate} = ${cinemaReleases.mxReleaseDate}
      )`,
    })
    .from(listItems)
    .innerJoin(lists, eq(lists.id, listItems.listId))
    .innerJoin(titles, and(eq(titles.catalogId, listItems.catalogId), eq(titles.userId, lists.userId)))
    .innerJoin(catalog, eq(catalog.id, listItems.catalogId))
    .innerJoin(cinemaReleases, eq(cinemaReleases.catalogId, catalog.id))
    .where(
      and(
        eq(lists.slug, WATCHLIST_SLUG),
        ne(cinemaReleases.status, "gone"),
        gte(cinemaReleases.mxReleaseDate, today),
        lte(cinemaReleases.mxReleaseDate, addDays(today, CINEMA_ALERT_WINDOW_DAYS)),
        exists(
          db.select({ one: sql`1` }).from(pushSubscriptions).where(eq(pushSubscriptions.userId, titles.userId)),
        ),
      ),
    );

/** What the step would announce right now (no writes). */
export const findCinemaArrivals = async (now = new Date()) => {
  const today = mxToday(now);
  const candidates = await loadCandidates(today);
  return { today, candidates: candidates.length, arrivals: selectCinemaArrivals(candidates, today) };
};

/**
 * Claims the ledger rows first (ON CONFLICT DO NOTHING) so overlapping runs never both send;
 * if no device took the push (all failed, none gone) the claim is released for the next run.
 */
const notifyUser = async (userId: string, arrivals: CinemaArrival[], today: string) => {
  const claimed = await db
    .insert(cinemaAlerts)
    .values(arrivals.map((arrival) => ({ userId, catalogId: arrival.catalogId, mxReleaseDate: arrival.mxReleaseDate })))
    .onConflictDoNothing()
    .returning({ catalogId: cinemaAlerts.catalogId });
  const claimedIds = new Set(claimed.map((row) => row.catalogId));
  const mine = arrivals.filter((arrival) => claimedIds.has(arrival.catalogId));
  const outcomes: PushSendOutcome[] = [];
  if (mine.length === 0) {
    return outcomes;
  }

  const subscriptions = await db
    .select({
      id: pushSubscriptions.id,
      endpoint: pushSubscriptions.endpoint,
      p256dh: pushSubscriptions.p256dh,
      auth: pushSubscriptions.auth,
    })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));

  const payloads = cinemaPayloadsForUser(mine, today);
  const goneIds: string[] = [];
  const sentIds = new Set<string>();
  for (const subscription of subscriptions) {
    for (const payload of payloads) {
      const outcome = await sendPush(subscription, payload);
      outcomes.push(outcome);
      if (outcome === "gone") {
        goneIds.push(subscription.id);
        break;
      }
      if (outcome === "sent") {
        sentIds.add(subscription.id);
      }
    }
  }

  if (goneIds.length > 0) {
    await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.id, goneIds));
  }
  if (sentIds.size > 0) {
    await db.update(pushSubscriptions).set({ lastSuccessAt: new Date() }).where(inArray(pushSubscriptions.id, [...sentIds]));
  } else if (outcomes.includes("failed")) {
    await db
      .delete(cinemaAlerts)
      .where(
        and(
          eq(cinemaAlerts.userId, userId),
          inArray(cinemaAlerts.catalogId, [...claimedIds]),
          inArray(cinemaAlerts.mxReleaseDate, mine.map((arrival) => arrival.mxReleaseDate)),
        ),
      );
  }
  return outcomes;
};

/** Cron step (after the cartelera): push «Llega a cines» for this week's Quiero ver premieres. */
export const notifyCinemaArrivals = async (now = new Date()): Promise<CinemaAlertsSummary> => {
  const summary: CinemaAlertsSummary = { candidates: 0, arrivals: 0, users: 0, sent: 0, gone: 0, failed: 0 };
  if (!isPushConfigured()) {
    return { ...summary, skipped: "push_not_configured" };
  }
  const { today, candidates, arrivals } = await findCinemaArrivals(now);
  summary.candidates = candidates;
  summary.arrivals = arrivals.length;

  const byUser = new Map<string, CinemaArrival[]>();
  for (const arrival of arrivals) {
    byUser.set(arrival.userId, [...(byUser.get(arrival.userId) ?? []), arrival]);
  }
  summary.users = byUser.size;

  await runPool([...byUser], SEND_CONCURRENCY, async ([userId, userArrivals]) => {
    try {
      for (const outcome of await notifyUser(userId, userArrivals, today)) {
        summary[outcome === "sent" ? "sent" : outcome === "gone" ? "gone" : "failed"] += 1;
      }
    } catch {
      summary.failed += 1;
    }
  });
  return summary;
};
