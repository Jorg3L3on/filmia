import { createId } from "@paralleldrive/cuid2";
import { and, eq, inArray } from "drizzle-orm";
import { db, pickEvents, pushSubscriptions, users } from "@/db";
import { mxToday } from "@/lib/cine-core";
import { RETO_PUSH_KIND, retoPushLens, retoPushPayload, shouldPushReto } from "@/lib/juegos/push";
import { firstNameOf, parseRetoJuego, RETO_JUEGOS, retoPath } from "@/lib/juegos/retos/core";
import type { RetoRow } from "@/lib/juegos/retos/store";
import { isPushConfigured, sendPush, type PushPayload, type PushSendOutcome } from "@/lib/push/web-push";

/**
 * «Te retaron» on the database (FIL-I53-3): sent right when a reto reaches someone, at most once a
 * Mexico City day. The push is a `reto_push` event first (lens `reto|<day>`), so a second reto that
 * day finds it and stays quiet; if no device took it, the event goes and the next reto may try.
 */

export type RetoPushSender = (
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: PushPayload,
) => Promise<PushSendOutcome>;

export type RetoPushResult = "sent" | "skipped" | "failed";

export const notifyRetado = async (
  reto: Pick<RetoRow, "id" | "juego" | "fromUserId" | "toUserId">,
  now = new Date(),
  options: { send?: RetoPushSender } = {},
): Promise<RetoPushResult> => {
  if (!reto.toUserId) return "skipped";
  const send = options.send ?? (isPushConfigured() ? sendPush : null);
  if (!send) return "skipped";
  const person = await db.query.users.findFirst({ where: eq(users.id, reto.toUserId), columns: { retosPush: true } });
  const subscriptions = await db
    .select({ id: pushSubscriptions.id, endpoint: pushSubscriptions.endpoint, p256dh: pushSubscriptions.p256dh, auth: pushSubscriptions.auth })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, reto.toUserId));
  const today = mxToday(now);
  const lens = retoPushLens(today);
  const sent = await db
    .select({ lens: pickEvents.lens })
    .from(pickEvents)
    .where(and(eq(pickEvents.userId, reto.toUserId), eq(pickEvents.kind, RETO_PUSH_KIND), eq(pickEvents.lens, lens)));
  if (!shouldPushReto({ retosPush: person?.retosPush ?? false, hasSubscription: subscriptions.length > 0, sent: new Set(sent.flatMap((row) => (row.lens ? [row.lens] : []))) }, today)) {
    return "skipped";
  }
  // Claim the day first, so two retos sent at once push once.
  const eventId = createId();
  await db.insert(pickEvents).values({ id: eventId, userId: reto.toUserId, titleId: null, catalogId: null, kind: RETO_PUSH_KIND, lens, createdAt: now });
  const claims = await db
    .select({ id: pickEvents.id })
    .from(pickEvents)
    .where(and(eq(pickEvents.userId, reto.toUserId), eq(pickEvents.kind, RETO_PUSH_KIND), eq(pickEvents.lens, lens)))
    .orderBy(pickEvents.createdAt, pickEvents.id);
  if (claims[0]?.id !== eventId) {
    await db.delete(pickEvents).where(eq(pickEvents.id, eventId));
    return "skipped";
  }
  const from = await db.query.users.findFirst({ where: eq(users.id, reto.fromUserId), columns: { name: true } });
  const juego = parseRetoJuego(reto.juego);
  const payload = retoPushPayload({
    fromName: firstNameOf(from?.name ?? null),
    juegoName: juego ? RETO_JUEGOS[juego].name : "Un reto",
    url: retoPath(reto.id),
  });
  const outcomes: PushSendOutcome[] = [];
  const goneIds: string[] = [];
  for (const subscription of subscriptions) {
    const outcome = await send(subscription, payload);
    outcomes.push(outcome);
    if (outcome === "gone") goneIds.push(subscription.id);
  }
  if (goneIds.length > 0) await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.id, goneIds));
  if (outcomes.includes("sent")) {
    await db.update(pushSubscriptions).set({ lastSuccessAt: now }).where(eq(pushSubscriptions.userId, reto.toUserId));
    return "sent";
  }
  await db.delete(pickEvents).where(eq(pickEvents.id, eventId));
  return "failed";
};

/** Perfil «Te retaron». */
export const loadRetosPush = async (userId: string) =>
  (await db.query.users.findFirst({ where: eq(users.id, userId), columns: { retosPush: true } }))?.retosPush ?? true;

export const setRetosPushFor = async (userId: string, enabled: boolean) => {
  await db.update(users).set({ retosPush: enabled }).where(eq(users.id, userId));
};
