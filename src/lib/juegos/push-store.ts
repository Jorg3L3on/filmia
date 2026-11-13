import { createId } from "@paralleldrive/cuid2";
import { and, eq, inArray, like } from "drizzle-orm";
import { db, pickEvents, pushSubscriptions, users } from "@/db";
import { mxToday } from "@/lib/cine-core";
import { JUEGOS, mxDayStart, weekKeyOf, type Juego } from "@/lib/juegos/core";
import {
  JUEGOS_PUSH_KIND,
  juegosPushPayload,
  juegosPushPlan,
  launchPushLens,
  tandaPushLens,
  type JuegosPushPlan,
} from "@/lib/juegos/push";
import { epochLabel, epochsOfWeek, TANDA_DEALT_KIND } from "@/lib/juegos/tanda/core";
import { sendPush, type PushSendOutcome } from "@/lib/push/web-push";

/**
 * Avisos de Juegos on the database (FIL-I50-5): the daily cron's selection and send. A push sent
 * is a `juegos_push` event (lens `tanda|<week>` or `launch|<id>`), so a rerun never repeats it.
 */

export type JuegosPushTarget = { userId: string; plan: Exclude<JuegosPushPlan, null> };

/** Who would get a push today, and which one. Reads only. */
export const selectJuegosPushTargets = async (now = new Date(), juegos: readonly Juego[] = JUEGOS): Promise<JuegosPushTarget[]> => {
  const today = mxToday(now);
  const week = weekKeyOf(now);
  const subscribed = await db
    .selectDistinct({ userId: pushSubscriptions.userId, juegosPush: users.juegosPush })
    .from(pushSubscriptions)
    .innerJoin(users, eq(users.id, pushSubscriptions.userId));
  const userIds = subscribed.filter((row) => row.juegosPush).map((row) => row.userId);
  if (userIds.length === 0) {
    return [];
  }
  const [sentRows, opened] = await Promise.all([
    db
      .select({ userId: pickEvents.userId, lens: pickEvents.lens, createdAt: pickEvents.createdAt })
      .from(pickEvents)
      .where(and(inArray(pickEvents.userId, userIds), eq(pickEvents.kind, JUEGOS_PUSH_KIND))),
    db
      .selectDistinct({ userId: pickEvents.userId })
      .from(pickEvents)
      .where(and(inArray(pickEvents.userId, userIds), eq(pickEvents.kind, TANDA_DEALT_KIND), like(pickEvents.lens, `${week}|%`))),
  ]);
  const openedSet = new Set(opened.map((row) => row.userId));
  const todayStart = mxDayStart(today);
  const targets: JuegosPushTarget[] = [];
  for (const userId of userIds) {
    const mine = sentRows.filter((row) => row.userId === userId);
    // Never two Juegos pushes on the same day.
    if (mine.some((row) => row.createdAt >= todayStart)) {
      continue;
    }
    const plan = juegosPushPlan(
      {
        juegosPush: true,
        hasSubscription: true,
        openedTandaThisWeek: openedSet.has(userId),
        sent: new Set(mine.flatMap((row) => (row.lens ? [row.lens] : []))),
      },
      { week, today, juegos },
    );
    if (plan) {
      targets.push({ userId, plan });
    }
  }
  return targets;
};

export type JuegosPushSummary = { targets: number; sent: number; failed: number; gone: number; dryRun: boolean };

/** The daily run: claims each push with its event first, then sends to every device of the person. */
export const sendJuegosPushes = async (now = new Date(), options: { dryRun?: boolean } = {}): Promise<JuegosPushSummary> => {
  const targets = await selectJuegosPushTargets(now);
  const summary: JuegosPushSummary = { targets: targets.length, sent: 0, failed: 0, gone: 0, dryRun: Boolean(options.dryRun) };
  if (options.dryRun || targets.length === 0) {
    return summary;
  }
  const week = weekKeyOf(now);
  const epoch = epochLabel(epochsOfWeek(week).main);
  for (const { userId, plan } of targets) {
    const lens = plan.kind === "launch" ? launchPushLens(plan.juego.id) : tandaPushLens(week);
    const eventId = createId();
    await db.insert(pickEvents).values({ id: eventId, userId, titleId: null, catalogId: null, kind: JUEGOS_PUSH_KIND, lens, createdAt: now });
    const subscriptions = await db
      .select({ id: pushSubscriptions.id, endpoint: pushSubscriptions.endpoint, p256dh: pushSubscriptions.p256dh, auth: pushSubscriptions.auth })
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, userId));
    const outcomes: PushSendOutcome[] = [];
    const goneIds: string[] = [];
    for (const subscription of subscriptions) {
      const outcome = await sendPush(subscription, juegosPushPayload(plan, epoch));
      outcomes.push(outcome);
      if (outcome === "gone") goneIds.push(subscription.id);
    }
    if (goneIds.length > 0) {
      await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.id, goneIds));
    }
    if (outcomes.includes("sent")) {
      summary.sent += 1;
      await db.update(pushSubscriptions).set({ lastSuccessAt: now }).where(eq(pushSubscriptions.userId, userId));
    } else {
      // Nothing reached a device: the claim goes, so tomorrow can try again.
      await db.delete(pickEvents).where(eq(pickEvents.id, eventId));
      if (outcomes.includes("failed")) summary.failed += 1;
    }
    summary.gone += goneIds.length;
  }
  return summary;
};

/** «Avisos de Juegos» in Perfil. */
export const loadJuegosPush = async (userId: string) =>
  (await db.query.users.findFirst({ where: eq(users.id, userId), columns: { juegosPush: true } }))?.juegosPush ?? true;

export const setJuegosPushFor = async (userId: string, enabled: boolean) => {
  await db.update(users).set({ juegosPush: enabled }).where(eq(users.id, userId));
};
