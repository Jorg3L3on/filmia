import { and, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import { db, titles } from "@/db";
import { runPool } from "@/lib/run-pool";
import { WATCH_PROVIDERS_CACHE_TTL_MS } from "@/lib/watch-providers";
import { refreshWatchProvidersMx } from "@/lib/watch-providers-cache";

export const WATCH_PROVIDERS_REFRESH_BATCH = 150;
const WATCH_PROVIDERS_REFRESH_CONCURRENCY = 5;

export type WatchProvidersRefreshSummary = {
  selected: number;
  refreshed: number;
  failed: number;
};

/**
 * Refreshes the oldest MX availability caches across all users. Watchlist
 * (unwatched) titles go first — that is where «¿dónde la veo hoy?» matters —
 * then never-checked titles, then the stalest caches.
 */
export const refreshStaleWatchProviders = async (
  limit = WATCH_PROVIDERS_REFRESH_BATCH,
): Promise<WatchProvidersRefreshSummary> => {
  const staleBefore = new Date(Date.now() - WATCH_PROVIDERS_CACHE_TTL_MS);

  const rows = await db
    .select({ id: titles.id, tmdbId: titles.tmdbId, kind: titles.kind })
    .from(titles)
    .where(
      and(
        isNotNull(titles.tmdbId),
        or(
          isNull(titles.watchProvidersFetchedAt),
          lt(titles.watchProvidersFetchedAt, staleBefore),
        ),
      ),
    )
    .orderBy(
      sql`${titles.watchedAt} IS NOT NULL`,
      sql`${titles.watchProvidersFetchedAt} ASC NULLS FIRST`,
    )
    .limit(limit);

  let refreshed = 0;
  let failed = 0;

  await runPool(rows, WATCH_PROVIDERS_REFRESH_CONCURRENCY, async (row) => {
    if (row.tmdbId == null) {
      return;
    }

    try {
      await refreshWatchProvidersMx(row.id, row.tmdbId, row.kind);
      refreshed += 1;
    } catch {
      failed += 1;
    }
  });

  return { selected: rows.length, refreshed, failed };
};
