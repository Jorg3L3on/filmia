import { exists, isNull, lt, or, sql } from "drizzle-orm";
import { catalog, db, titles } from "@/db";
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
 * Refreshes the oldest MX availability caches, one lookup per film (the
 * catalog is shared, so the daily budget covers distinct titles, not copies).
 * Films somebody still has unwatched go first — that is where «¿dónde la veo
 * hoy?» matters — then never-checked rows, then the stalest caches.
 */
export const refreshStaleWatchProviders = async (
  limit = WATCH_PROVIDERS_REFRESH_BATCH,
): Promise<WatchProvidersRefreshSummary> => {
  const staleBefore = new Date(Date.now() - WATCH_PROVIDERS_CACHE_TTL_MS);
  const unwatchedSomewhere = exists(
    db
      .select({ one: sql`1` })
      .from(titles)
      .where(sql`${titles.catalogId} = ${catalog.id} AND ${titles.watchedAt} IS NULL`),
  );

  const rows = await db
    .select({ id: catalog.id, tmdbId: catalog.tmdbId, kind: catalog.kind })
    .from(catalog)
    .where(
      or(
        isNull(catalog.watchProvidersFetchedAt),
        lt(catalog.watchProvidersFetchedAt, staleBefore),
      ),
    )
    .orderBy(
      sql`CASE WHEN ${unwatchedSomewhere} THEN 0 ELSE 1 END`,
      sql`${catalog.watchProvidersFetchedAt} ASC NULLS FIRST`,
    )
    .limit(limit);

  let refreshed = 0;
  let failed = 0;

  await runPool(rows, WATCH_PROVIDERS_REFRESH_CONCURRENCY, async (row) => {
    try {
      await refreshWatchProvidersMx(row.id, row.tmdbId, row.kind);
      refreshed += 1;
    } catch {
      failed += 1;
    }
  });

  return { selected: rows.length, refreshed, failed };
};
