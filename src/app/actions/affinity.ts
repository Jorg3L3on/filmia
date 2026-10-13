"use server";

import { createId } from "@paralleldrive/cuid2";
import { and, eq, gte } from "drizzle-orm";
import { catalog, db, pickEvents } from "@/db";
import { AFFINITY_SHOWN_KIND, affinityEventLens } from "@/lib/affinity-store";
import { requireUserId } from "@/lib/session";
import type { AffinityLevel } from "@/lib/tonight/affinity";

const LEVELS: readonly AffinityLevel[] = ["alta", "media", "baja"];
/** One record per film per day: reopening the ficha is not a new prediction. */
const DEDUPE_MS = 24 * 60 * 60 * 1000;

/**
 * FIL-I9-5 · the ficha showed «Para ti» for this film: keep the level so it can be
 * compared with the rating the user gives later (`npm run metrics:affinity`).
 * Best-effort; never throws to the client.
 */
export const recordAffinityShown = async (
  catalogId: string,
  level: AffinityLevel,
  lowConfidence: boolean,
): Promise<void> => {
  try {
    if (typeof catalogId !== "string" || !catalogId || !LEVELS.includes(level)) {
      return;
    }
    const userId = await requireUserId();
    const since = new Date(Date.now() - DEDUPE_MS);
    const [existing, film] = await Promise.all([
      db.query.pickEvents.findFirst({
        where: and(
          eq(pickEvents.userId, userId),
          eq(pickEvents.catalogId, catalogId),
          eq(pickEvents.kind, AFFINITY_SHOWN_KIND),
          gte(pickEvents.createdAt, since),
        ),
        columns: { id: true },
      }),
      db.query.catalog.findFirst({ where: eq(catalog.id, catalogId), columns: { id: true } }),
    ]);
    if (existing || !film) {
      return;
    }
    await db.insert(pickEvents).values({
      id: createId(),
      userId,
      titleId: null,
      catalogId,
      kind: AFFINITY_SHOWN_KIND,
      lens: affinityEventLens(level, Boolean(lowConfidence)),
    });
  } catch {
    // Telemetry never gets in the way of the ficha.
  }
};
