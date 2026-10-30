import { and, eq, isNull, lt, or } from "drizzle-orm";
import { db, users } from "@/db";
import { scheduleAfterResponse } from "@/lib/after-response";

/** Admin panel (FIL-I37): `User.lastActiveAt` is written at most once per this window. */
export const LAST_ACTIVE_EVERY_MS = 15 * 60 * 1000;

export const shouldTouchLastActive = (lastMs: number | null | undefined, nowMs: number) =>
  lastMs == null || nowMs - lastMs >= LAST_ACTIVE_EVERY_MS;

/** One conditional UPDATE: rows touched within the window are left alone. */
export const writeLastActive = async (userId: string, now: Date) => {
  const cutoff = new Date(now.getTime() - LAST_ACTIVE_EVERY_MS);
  await db
    .update(users)
    .set({ lastActiveAt: now })
    .where(and(eq(users.id, userId), or(isNull(users.lastActiveAt), lt(users.lastActiveAt, cutoff))));
};

// Per-instance memo so most requests skip the database entirely; the UPDATE's own condition
// covers other instances.
const touchedAt = new Map<string, number>();
const MAX_MEMO = 5000;

/**
 * Marks the user active. Never blocks render: the write runs after the response, and errors
 * (e.g. the column is missing before 0025) are swallowed.
 */
export const touchLastActive = (userId: string, now: Date = new Date()) => {
  const nowMs = now.getTime();
  if (!shouldTouchLastActive(touchedAt.get(userId), nowMs)) {
    return;
  }
  if (touchedAt.size >= MAX_MEMO) {
    touchedAt.clear();
  }
  touchedAt.set(userId, nowMs);
  scheduleAfterResponse(async () => {
    try {
      await writeLastActive(userId, now);
    } catch {
      // Best effort.
    }
  });
};

/** Tests only. */
export const resetLastActiveMemoForTests = () => touchedAt.clear();
