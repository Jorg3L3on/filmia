import { and, eq, max, sql } from "drizzle-orm";
import { db, paraTiPool } from "@/db";
import { findCatalogByTmdb, findOrCreateCatalog } from "@/lib/catalog";
import { enrichCatalog } from "@/lib/catalog-enrich";
import {
  DEFAULT_REFRESH_CAPS,
  poolKeyId,
  refreshParaTiPools,
  type ListedCandidate,
  type MaterializeResult,
  type PoolKey,
  type PoolRow,
  type RefreshCaps,
} from "@/lib/para-ti/refresh";
import { parseStoredKeywords, parseStoredPeople } from "@/lib/tonight-store";
import { discoverTmdb } from "@/lib/tmdb";
import { isWatchProvidersCacheFresh } from "@/lib/watch-providers";
import { refreshWatchProvidersMx } from "@/lib/watch-providers-cache";

/** TMDB calls one enrichment costs: details, external ids, MX providers (the poster is the image CDN). */
const ENRICH_TMDB_CALLS = 3;

const poolFreshness = async () => {
  const rows = await db
    .select({ antojo: paraTiPool.antojo, kind: paraTiPool.kind, at: max(paraTiPool.fetchedAt) })
    .from(paraTiPool)
    .groupBy(paraTiPool.antojo, paraTiPool.kind);
  return new Map(
    rows.map((row) => [poolKeyId({ antojo: row.antojo as PoolKey["antojo"], kind: row.kind }), row.at?.getTime() ?? 0]),
  );
};

/**
 * The pool's Catalog row for a discover hit. A new or bare row gets TMDB enrichment (genres,
 * keywords, people, runtime, providers, ambient) without OMDb: its free quota stays for saves;
 * a known row only refreshes MX providers when they are older than a week.
 */
const materialize = async (
  candidate: ListedCandidate,
  { allowCreate }: { allowCreate: boolean },
): Promise<MaterializeResult> => {
  const existing = await findCatalogByTmdb(candidate.tmdbId, candidate.kind);
  if (!existing && !allowCreate) {
    return null;
  }
  const { row, created } = existing
    ? { row: existing, created: false }
    : await findOrCreateCatalog({
        tmdbId: candidate.tmdbId,
        kind: candidate.kind,
        name: candidate.name,
        originalName: candidate.originalName,
        year: candidate.year,
        posterPath: candidate.posterPath,
      });

  const bare = parseStoredKeywords(row.tmdbKeywords).length === 0 && parseStoredPeople(row.tmdbPeople).length === 0;
  if (created || bare) {
    try {
      await enrichCatalog(row, { omdb: false });
    } catch {
      // The row keeps the discover snapshot; the next run tries again.
    }
    return { catalogId: row.id, created, tmdbCalls: ENRICH_TMDB_CALLS };
  }
  if (!isWatchProvidersCacheFresh(row.watchProvidersFetchedAt)) {
    try {
      await refreshWatchProvidersMx(row.id, row.tmdbId, row.kind);
    } catch {
      // Stale providers are better than none: the row stays in the pool.
    }
    return { catalogId: row.id, created: false, tmdbCalls: 1 };
  }
  return { catalogId: row.id, created: false, tmdbCalls: 0 };
};

/** Replace one pool in one batch. */
const writePool = async (key: PoolKey, rows: readonly PoolRow[], at: Date) => {
  const where = and(eq(paraTiPool.antojo, key.antojo), eq(paraTiPool.kind, key.kind));
  await db.batch([
    db.delete(paraTiPool).where(where),
    db.insert(paraTiPool).values(
      rows.map((row) => ({
        antojo: key.antojo,
        kind: key.kind,
        catalogId: row.catalogId,
        rank: row.rank,
        voteAverage: row.voteAverage,
        voteCount: row.voteCount,
        fetchedAt: at,
      })),
    ),
  ]);
};

/** One refresh run over the real TMDB and database (the cron and `npm run para-ti:llenar`). */
export const runParaTiRefresh = (caps: Partial<RefreshCaps> = {}, now = new Date()) => {
  const startedAt = Date.now();
  return refreshParaTiPools(
    {
      now,
      freshness: poolFreshness,
      discover: (options) => discoverTmdb(options),
      materialize,
      writePool,
      elapsedMs: () => Date.now() - startedAt,
    },
    { ...DEFAULT_REFRESH_CAPS, ...caps },
  );
};

/** Rows per antojo × kind, for the fill script and checks. */
export const paraTiPoolCounts = async () => {
  const rows = await db
    .select({ antojo: paraTiPool.antojo, kind: paraTiPool.kind, rows: sql<number>`count(*)::int` })
    .from(paraTiPool)
    .groupBy(paraTiPool.antojo, paraTiPool.kind);
  return rows.sort((a, b) => a.antojo.localeCompare(b.antojo) || a.kind.localeCompare(b.kind));
};
