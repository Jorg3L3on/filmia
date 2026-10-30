import { sql } from "drizzle-orm";
import { apiUsage, db } from "@/db";
import { scheduleAfterResponse } from "@/lib/after-response";

/**
 * Admin panel (FIL-I37): counts real network calls to OMDb and TMDB per UTC day in `ApiUsage`.
 * Callers bump it right after `fetch` answers, so cache hits (`unstable_cache`) never count.
 */
export type ApiProvider = "omdb" | "tmdb";

/** The `ApiUsage.day` key: OMDb's free quota resets at midnight UTC. */
export const utcDay = (now: Date = new Date()) => now.toISOString().slice(0, 10);

export const bumpApiUsage = async (provider: ApiProvider, day: string) => {
  await db
    .insert(apiUsage)
    .values({ provider, day, count: 1 })
    .onConflictDoUpdate({
      target: [apiUsage.provider, apiUsage.day],
      set: { count: sql`${apiUsage.count} + 1` },
    });
};

type ApiUsageWriter = (provider: ApiProvider, day: string) => Promise<void>;

let writer: ApiUsageWriter = bumpApiUsage;

/** Tests only: swap the database write for a recorder; no argument restores it. */
export const setApiUsageWriterForTests = (next?: ApiUsageWriter) => {
  writer = next ?? bumpApiUsage;
};

/**
 * One real request reached the provider. Never blocks or breaks the caller: the write runs after
 * the response, and errors (e.g. `ApiUsage` not created yet, before 0026) are swallowed.
 */
export const recordApiCall = (provider: ApiProvider, now: Date = new Date()) => {
  const day = utcDay(now);
  scheduleAfterResponse(async () => {
    try {
      await writer(provider, day);
    } catch {
      // Counting is best effort.
    }
  });
};
