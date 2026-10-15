import { lt, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, rateLimits } from "@/db";
import {
  RATE_LIMIT_MESSAGE,
  checkRateLimit,
  type RateLimitCheck,
  type RateLimitStore,
} from "@/lib/rate-limit";

/** Roughly one write in 50 also sweeps windows that ended a day ago. */
const SWEEP_PROBABILITY = 0.02;

/** One atomic upsert per hit: a new window when the stored one has ended, else count + 1. */
export const postgresRateLimitStore: RateLimitStore = {
  hit: async (key, windowMs, now) => {
    const resetAt = new Date(now.getTime() + windowMs);
    // Same encoding drizzle uses for `timestamp` columns (ISO, read as UTC).
    const nowParam = sql`${now.toISOString()}::timestamp`;
    const [row] = await db
      .insert(rateLimits)
      .values({ key, count: 1, resetAt })
      .onConflictDoUpdate({
        target: rateLimits.key,
        set: {
          count: sql`CASE WHEN ${rateLimits.resetAt} <= ${nowParam} THEN 1 ELSE ${rateLimits.count} + 1 END`,
          resetAt: sql`CASE WHEN ${rateLimits.resetAt} <= ${nowParam} THEN excluded."resetAt" ELSE ${rateLimits.resetAt} END`,
        },
      })
      .returning({ count: rateLimits.count, resetAt: rateLimits.resetAt });

    if (Math.random() < SWEEP_PROBABILITY) {
      const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      // Best effort: a failed sweep must not fail the sign-in.
      await db
        .delete(rateLimits)
        .where(lt(rateLimits.resetAt, dayAgo))
        .catch(() => undefined);
    }

    return { count: row!.count, resetAt: row!.resetAt };
  },
};

/**
 * Rate-limit an auth attempt against Postgres. Fails open (and logs) when the store is
 * unreachable: the attempt itself needs the database, so it fails right after anyway.
 */
export const checkAuthRateLimit = async (
  attempts: Parameters<typeof checkRateLimit>[1],
): Promise<RateLimitCheck> => {
  try {
    return await checkRateLimit(postgresRateLimitStore, attempts);
  } catch (error) {
    console.error("[rate-limit] store unavailable", error);
    return { ok: true };
  }
};

/** The 429 the auth route handlers answer with, in the `{ error }` shape their forms read. */
export const tooManyAttempts = (check: Extract<RateLimitCheck, { ok: false }>) =>
  NextResponse.json(
    { error: RATE_LIMIT_MESSAGE },
    { status: 429, headers: { "retry-after": String(check.retryAfterSeconds) } },
  );
