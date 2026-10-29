import { eq, max } from "drizzle-orm";
import { db, tonightRecos } from "@/db";
import { scheduleAfterResponse } from "@/lib/after-response";
import { isTmdbConfigured } from "@/lib/tmdb";

/**
 * FIL-26 · Hoy never waits for the nightly cron: a new account (Bienvenida), or one whose pool ran
 * out (¿Las viste? marks many recommendations as seen), gets its pool rebuilt right after
 * the response, and Hoy says it is looking meanwhile.
 */

/** Fewer recommendations left to show than this: ask for a fresh pool. */
export const RECO_REFILL_BELOW = 6;
/** A thin pool younger than this waits for the cron; an exhausted one (none left) never waits. */
export const RECO_REFILL_FRESH_MS = 30 * 60 * 1000;
/** One rebuild per user and instance in this window, so a rebuild that finds nothing does not loop. */
export const RECO_REFILL_COOLDOWN_MS = 10 * 60 * 1000;

export const needsRecoRefill = ({
  usable,
  poolComputedAt,
  requestedAt,
  now,
}: {
  usable: number;
  poolComputedAt: Date | null;
  requestedAt: number | null;
  now: Date;
}) => {
  if (usable >= RECO_REFILL_BELOW) {
    return false;
  }
  if (requestedAt != null && now.getTime() - requestedAt < RECO_REFILL_COOLDOWN_MS) {
    return false;
  }
  if (usable > 0 && poolComputedAt && now.getTime() - poolComputedAt.getTime() < RECO_REFILL_FRESH_MS) {
    return false;
  }
  return true;
};

const inFlight = new Set<string>();
const requested = new Map<string, number>();

const poolComputedAt = async (userId: string) => {
  const [row] = await db
    .select({ computedAt: max(tonightRecos.computedAt) })
    .from(tonightRecos)
    .where(eq(tonightRecos.userId, userId));
  return row?.computedAt ?? null;
};

/**
 * Rebuild the pool after the response when it is thin. Returns true while a rebuild is under way
 * and there is nothing to recommend yet: Hoy shows «Buscando recomendaciones…» and refreshes.
 */
export const refillRecosIfThin = async (userId: string, usable: number, now = new Date()) => {
  if (inFlight.has(userId)) {
    return usable === 0;
  }
  if (usable >= RECO_REFILL_BELOW || !isTmdbConfigured()) {
    return false;
  }
  const computedAt = await poolComputedAt(userId);
  if (!needsRecoRefill({ usable, poolComputedAt: computedAt, requestedAt: requested.get(userId) ?? null, now })) {
    return false;
  }
  requested.set(userId, now.getTime());
  inFlight.add(userId);
  scheduleAfterResponse(async () => {
    try {
      // reco-store reads tonight-store, which calls this: loaded late to keep the cycle out.
      const { computeRecosForUser } = await import("@/lib/tonight/reco-store");
      const result = await computeRecosForUser(userId);
      if (result.ok && result.picks.length > 0) {
        // The cooldown is for rebuilds that find nothing: a pool used up later may ask again.
        requested.delete(userId);
      }
    } catch {
      // The nightly cron tries again.
    } finally {
      inFlight.delete(userId);
    }
  });
  return usable === 0;
};
