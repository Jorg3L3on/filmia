"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, users } from "@/db";
import { requireUserId } from "@/lib/session";
import { isHHMM, parseNightEnds } from "@/lib/tonight/time";
import type { PickEventKind } from "@/lib/tonight";
import {
  isPickEventKind,
  recordPickEvents as persistPickEvents,
  scheduleTonightRecompute,
} from "@/lib/tonight-store";

export type PickEventInput = {
  titleId: string;
  kind: PickEventKind;
  lens?: string | null;
};

const MAX_BATCH = 40;

/** Impressions, skips and opens from the sala — batched, fire-and-forget. */
export const recordPickEvents = async (events: PickEventInput[]) => {
  const userId = await requireUserId();
  const clean = events
    .filter(
      (event) =>
        typeof event.titleId === "string" &&
        event.titleId.length > 0 &&
        isPickEventKind(event.kind),
    )
    .slice(0, MAX_BATCH);
  await persistPickEvents(userId, clean);
};

/** «Ahora no»: hide for 14 nights and teach the ranker. */
export const markNotTonight = async (titleId: string, lens?: string | null) => {
  const userId = await requireUserId();
  await persistPickEvents(userId, [{ titleId, kind: "not_tonight", lens }]);
  scheduleTonightRecompute(userId);
  revalidatePath("/");
};

/** Más así / Menos así from the «Por qué esta» sheet. */
export const sendTasteFeedback = async (
  titleId: string,
  kind: "more_like" | "less_like",
  lens?: string | null,
) => {
  const userId = await requireUserId();
  await persistPickEvents(userId, [{ titleId, kind, lens }]);
  scheduleTonightRecompute(userId);
  revalidatePath("/");
};

export const updateNightEnds = async (formData: FormData) => {
  const userId = await requireUserId();
  const weekday = String(formData.get("weekday") ?? "").trim();
  const weekend = String(formData.get("weekend") ?? "").trim();
  if (!isHHMM(weekday) || !isHHMM(weekend)) {
    throw new Error("La hora debe tener formato HH:MM.");
  }
  const nightEndsAt = parseNightEnds({ weekday, weekend });
  await db.update(users).set({ nightEndsAt }).where(eq(users.id, userId));
  revalidatePath("/");
  revalidatePath("/perfil");
};
