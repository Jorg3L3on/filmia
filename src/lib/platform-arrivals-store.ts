import { and, eq, exists, gte, inArray, isNull, sql } from "drizzle-orm";
import {
  catalog,
  db,
  listItems,
  lists,
  platformAlerts,
  pushSubscriptions,
  titles,
  users,
} from "@/db";
import { WATCHLIST_SLUG } from "@/lib/lists";
import {
  ARRIVAL_WINDOW_MS,
  arrivalPayloadsForUser,
  selectArrivals,
  type ArrivalCandidate,
  type PlatformArrival,
} from "@/lib/platform-arrivals";
import { isPushConfigured, sendPush, type PushSendOutcome } from "@/lib/push/web-push";
import { runPool } from "@/lib/run-pool";

const SEND_CONCURRENCY = 5;

export type PlatformArrivalsSummary = {
  skipped?: "push_not_configured";
  candidates: number;
  arrivals: number;
  users: number;
  sent: number;
  gone: number;
  failed: number;
};

/**
 * Quiero ver entries (unwatched) of users with at least one push subscription whose film got
 * an `availableSince` stamp inside the window and that nobody told them about yet.
 */
export const arrivalCandidatesQuery = (now: Date) => {
  const since = new Date(now.getTime() - ARRIVAL_WINDOW_MS);

  return db
    .select({
      userId: titles.userId,
      titleId: titles.id,
      catalogId: catalog.id,
      name: catalog.name,
      availableSince: catalog.availableSince,
      addedAt: listItems.addedAt,
      watchProvidersMx: catalog.watchProvidersMx,
      streamingPlatforms: users.streamingPlatforms,
    })
    .from(listItems)
    .innerJoin(lists, eq(lists.id, listItems.listId))
    .innerJoin(titles, eq(titles.id, listItems.titleId))
    .innerJoin(catalog, eq(catalog.id, titles.catalogId))
    .innerJoin(users, eq(users.id, titles.userId))
    .where(
      and(
        eq(lists.slug, WATCHLIST_SLUG),
        isNull(titles.watchedAt),
        gte(catalog.availableSince, since),
        exists(
          db
            .select({ one: sql`1` })
            .from(pushSubscriptions)
            .where(eq(pushSubscriptions.userId, titles.userId)),
        ),
        sql`NOT EXISTS (
          SELECT 1 FROM ${platformAlerts}
          WHERE ${platformAlerts.userId} = ${titles.userId}
            AND ${platformAlerts.catalogId} = ${catalog.id}
            AND ${platformAlerts.availableSince} = ${catalog.availableSince}
        )`,
      ),
    );
};

const loadArrivalCandidates = async (now: Date): Promise<ArrivalCandidate[]> => {
  const rows = await arrivalCandidatesQuery(now);
  return rows.flatMap((row) => (row.availableSince ? [{ ...row, availableSince: row.availableSince }] : []));
};

/** Phase 2: what the cron would announce right now (no writes). */
export const findPlatformArrivals = async (now = new Date()) => {
  const candidates = await loadArrivalCandidates(now);
  return { candidates: candidates.length, arrivals: selectArrivals(candidates, now) };
};

const groupByUser = (arrivals: readonly PlatformArrival[]) => {
  const byUser = new Map<string, PlatformArrival[]>();
  for (const arrival of arrivals) {
    const list = byUser.get(arrival.userId) ?? [];
    list.push(arrival);
    byUser.set(arrival.userId, list);
  }
  return byUser;
};

/**
 * Claims the ledger rows first (ON CONFLICT DO NOTHING), so two overlapping runs can't both
 * send; only what this run claimed is pushed. If no device took it (all failed, none gone),
 * the claim is released and the next run retries while the arrival is still in the window.
 */
const notifyUser = async (userId: string, arrivals: PlatformArrival[]) => {
  const claimed = await db
    .insert(platformAlerts)
    .values(
      arrivals.map((arrival) => ({
        userId,
        catalogId: arrival.catalogId,
        availableSince: arrival.availableSince,
        platform: arrival.platform,
      })),
    )
    .onConflictDoNothing()
    .returning({ catalogId: platformAlerts.catalogId });

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

  const payloads = arrivalPayloadsForUser(mine);
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
    await db
      .update(pushSubscriptions)
      .set({ lastSuccessAt: new Date() })
      .where(inArray(pushSubscriptions.id, [...sentIds]));
  } else if (outcomes.includes("failed")) {
    await db
      .delete(platformAlerts)
      .where(
        and(
          eq(platformAlerts.userId, userId),
          inArray(platformAlerts.catalogId, [...claimedIds]),
          inArray(
            platformAlerts.availableSince,
            mine.map((arrival) => arrival.availableSince),
          ),
        ),
      );
  }

  return outcomes;
};

/** Phase 3: push «Llegó a tu plataforma» for every new arrival. Runs after the daily refresh. */
export const notifyPlatformArrivals = async (now = new Date()): Promise<PlatformArrivalsSummary> => {
  const summary: PlatformArrivalsSummary = {
    candidates: 0,
    arrivals: 0,
    users: 0,
    sent: 0,
    gone: 0,
    failed: 0,
  };
  if (!isPushConfigured()) {
    return { ...summary, skipped: "push_not_configured" };
  }

  const { candidates, arrivals } = await findPlatformArrivals(now);
  summary.candidates = candidates;
  summary.arrivals = arrivals.length;

  const byUser = [...groupByUser(arrivals)];
  summary.users = byUser.length;

  await runPool(byUser, SEND_CONCURRENCY, async ([userId, userArrivals]) => {
    try {
      const outcomes = await notifyUser(userId, userArrivals);
      for (const outcome of outcomes) {
        summary[outcome === "sent" ? "sent" : outcome === "gone" ? "gone" : "failed"] += 1;
      }
    } catch {
      summary.failed += 1;
    }
  });

  return summary;
};
