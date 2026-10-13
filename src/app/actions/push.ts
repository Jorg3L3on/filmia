"use server";

import { createId } from "@paralleldrive/cuid2";
import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { db, pushSubscriptions } from "@/db";
import { parsePushSubscription } from "@/lib/push-subscription";
import { isPushConfigured } from "@/lib/push/web-push";
import { requireUserId } from "@/lib/session";

export type PushActionResult = { ok: true } | { error: string };

/**
 * Perfil «Avisos» on: stores this browser's push subscription for the signed-in user.
 * The endpoint is unique per browser, so a shared device that switches accounts moves
 * the row to whoever turned it on last.
 */
export const savePushSubscription = async (input: unknown): Promise<PushActionResult> => {
  const userId = await requireUserId();

  if (!isPushConfigured()) {
    return { error: "Los avisos no están disponibles todavía." };
  }

  const subscription = parsePushSubscription(input);
  if (!subscription) {
    return { error: "Este navegador no dio una suscripción válida." };
  }

  const userAgent = (await headers()).get("user-agent")?.slice(0, 300) ?? null;

  await db
    .insert(pushSubscriptions)
    .values({ id: createId(), userId, ...subscription, userAgent })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { userId, p256dh: subscription.p256dh, auth: subscription.auth, userAgent },
    });

  return { ok: true };
};

/** Perfil «Avisos» off (or the browser dropped it): forgets this browser's endpoint. */
export const deletePushSubscription = async (endpoint: unknown): Promise<PushActionResult> => {
  const userId = await requireUserId();
  if (typeof endpoint !== "string" || endpoint.length === 0) {
    return { error: "Falta el endpoint." };
  }

  await db
    .delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)));

  return { ok: true };
};
