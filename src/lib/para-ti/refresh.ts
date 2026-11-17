import type { TitleKind } from "@/db/schema";
import { ANTOJOS, POOL_KINDS, POOL_MIN_VOTES, antojoById, type AntojoId } from "@/lib/para-ti/antojos";
import { runPool } from "@/lib/run-pool";
import type { TmdbDiscoverOptions } from "@/lib/tmdb-discover-params";

/**
 * Para ti's pool refresh (FIL-I60-2), free of the database and the network so its rules are
 * testable: the stalest antojo × kind goes first, every run stops creating Catalog rows at a cap,
 * stops starting pools when its TMDB-call or time budget is spent, and a pool whose TMDB lists all
 * failed keeps what it had. `pool-store.ts` plugs the real TMDB and Postgres in.
 */

export type PoolKey = { antojo: AntojoId; kind: TitleKind };

export const poolKeyId = (key: PoolKey) => `${key.antojo}:${key.kind}`;

/** `fetchedAt` of a pool the new-row cap cut short: as stale as a pool never filled. */
export const STALE_AT = new Date(0);

/** A discover hit as the pool needs it. */
export type ListedCandidate = {
  tmdbId: number;
  kind: TitleKind;
  name: string;
  originalName: string | null;
  year: number | null;
  posterPath: string | null;
  voteAverage: number | null;
  voteCount: number;
};

export type MaterializeResult = {
  catalogId: string;
  created: boolean;
  /** TMDB calls spent on this title (enrichment, provider refresh). */
  tmdbCalls: number;
} | null;

export type PoolRow = { catalogId: string; rank: number; voteAverage: number | null; voteCount: number };

export type RefreshDeps = {
  now: Date;
  /** Latest `fetchedAt` per pool (`poolKeyId`), ms since epoch. A pool not there was never filled. */
  freshness: () => Promise<ReadonlyMap<string, number>>;
  discover: (options: TmdbDiscoverOptions) => Promise<readonly ListedCandidate[]>;
  /**
   * The title's Catalog row, enriched when it lacks taste data. `allowCreate: false` means the cap
   * is reached: return null for a title with no row yet instead of creating one.
   */
  materialize: (candidate: ListedCandidate, options: { allowCreate: boolean }) => Promise<MaterializeResult>;
  writePool: (key: PoolKey, rows: readonly PoolRow[], at: Date) => Promise<void>;
  /** Ms since the run started. */
  elapsedMs: () => number;
};

export type RefreshCaps = {
  /** New Catalog rows one run may create. */
  maxNewCatalog: number;
  /** TMDB calls one run may spend; a pool is not started once it is spent. */
  maxTmdbCalls: number;
  /** No pool starts after this many ms (the route's maxDuration is 300 s). */
  startBudgetMs: number;
  /** Candidates a pool aims for before its pages stop. */
  poolTarget: number;
  /** Discover pages per query, at most. */
  maxPages: number;
  /** A pool refreshed less than this long ago is left alone. */
  freshMs: number;
  /** Titles materialized in parallel. */
  concurrency: number;
};

export const DEFAULT_REFRESH_CAPS: RefreshCaps = {
  maxNewCatalog: 250,
  maxTmdbCalls: 1500,
  startBudgetMs: 230_000,
  poolTarget: 100,
  maxPages: 5,
  freshMs: 20 * 60 * 60 * 1000,
  concurrency: 4,
};

export type RefreshSummary = {
  pools: number;
  refreshed: number;
  skippedFresh: number;
  deferred: number;
  failed: number;
  rowsWritten: number;
  newCatalogRows: number;
  tmdbCalls: number;
  /** Pools refreshed in this run, in the order they ran: «antojo:KIND kept/listed», «cut» when the cap stopped it. */
  order: string[];
};

/** Every antojo × kind, the stalest first (never filled before filled once; ties keep antojo order). */
export const stalestFirst = (freshness: ReadonlyMap<string, number>): PoolKey[] => {
  const keys = ANTOJOS.flatMap((antojo) => POOL_KINDS.map((kind) => ({ antojo: antojo.id, kind })));
  return keys
    .map((key, index) => ({ key, index, at: freshness.get(poolKeyId(key)) ?? 0 }))
    .sort((a, b) => a.at - b.at || a.index - b.index)
    .map((entry) => entry.key);
};

/**
 * Pages each query, interleaving them page by page so every query feeds the pool, keeps the
 * first sighting of a title, drops titles without a poster or under the vote floor.
 */
export const mergeListed = (pages: readonly (readonly ListedCandidate[])[], kind: TitleKind): ListedCandidate[] => {
  const seen = new Set<number>();
  const merged: ListedCandidate[] = [];
  for (const page of pages) {
    for (const candidate of page) {
      if (candidate.kind !== kind || seen.has(candidate.tmdbId)) continue;
      seen.add(candidate.tmdbId);
      if (!candidate.posterPath || candidate.voteCount < POOL_MIN_VOTES[kind]) continue;
      merged.push(candidate);
    }
  }
  return merged;
};

export const refreshParaTiPools = async (
  deps: RefreshDeps,
  caps: RefreshCaps = DEFAULT_REFRESH_CAPS,
): Promise<RefreshSummary> => {
  const freshness = await deps.freshness();
  const queue = stalestFirst(freshness);
  const summary: RefreshSummary = {
    pools: queue.length,
    refreshed: 0,
    skippedFresh: 0,
    deferred: 0,
    failed: 0,
    rowsWritten: 0,
    newCatalogRows: 0,
    tmdbCalls: 0,
    order: [],
  };
  let created = 0;

  for (const key of queue) {
    const at = freshness.get(poolKeyId(key)) ?? 0;
    if (deps.now.getTime() - at < caps.freshMs) {
      summary.skippedFresh += 1;
      continue;
    }
    if (deps.elapsedMs() > caps.startBudgetMs || summary.tmdbCalls >= caps.maxTmdbCalls) {
      summary.deferred += 1;
      continue;
    }

    const queries = antojoById(key.antojo)?.queries(key.kind, deps.now) ?? [];
    const pages: ListedCandidate[][] = [];
    let attempted = 0;
    let failures = 0;
    let listed = 0;
    for (let page = 1; page <= caps.maxPages && listed < caps.poolTarget; page += 1) {
      for (const query of queries) {
        if (summary.tmdbCalls >= caps.maxTmdbCalls) break;
        attempted += 1;
        summary.tmdbCalls += 1;
        try {
          const items = await deps.discover({
            ...query,
            kind: key.kind,
            page,
            ...(key.kind === "MOVIE" ? { region: "MX" } : {}),
          });
          pages.push([...items]);
        } catch {
          failures += 1;
        }
      }
      listed = mergeListed(pages, key.kind).length;
    }
    if (attempted === 0 || failures === attempted) {
      // TMDB down (or the key): the previous pool stays.
      summary.failed += 1;
      continue;
    }

    const candidates = mergeListed(pages, key.kind).slice(0, caps.poolTarget);
    const kept = new Map<number, PoolRow>();
    let cut = false;
    await runPool(
      candidates.map((candidate, rank) => ({ candidate, rank })),
      caps.concurrency,
      async ({ candidate, rank }) => {
        // Claim a creation slot before awaiting so parallel workers never pass the cap.
        const allowCreate = created < caps.maxNewCatalog;
        if (allowCreate) created += 1;
        let result: MaterializeResult = null;
        try {
          result = await deps.materialize(candidate, { allowCreate });
        } catch {
          result = null;
        }
        if (allowCreate && !result?.created) created -= 1;
        if (!result) {
          if (!allowCreate) cut = true;
          return;
        }
        summary.tmdbCalls += result.tmdbCalls;
        if (result.created) summary.newCatalogRows += 1;
        kept.set(rank, {
          catalogId: result.catalogId,
          rank,
          voteAverage: candidate.voteAverage,
          voteCount: candidate.voteCount,
        });
      },
    );

    const rows = [...kept.values()].sort((a, b) => a.rank - b.rank).map((row, rank) => ({ ...row, rank }));
    if (rows.length === 0) {
      // Nothing known and no room left to create rows: the pool waits for the next run.
      if (created >= caps.maxNewCatalog) summary.deferred += 1;
      else summary.failed += 1;
      continue;
    }
    // A pool the cap cut short is written stale (epoch), so the next run finishes it first.
    await deps.writePool(key, rows, cut ? STALE_AT : deps.now);
    summary.refreshed += 1;
    summary.rowsWritten += rows.length;
    summary.order.push(`${poolKeyId(key)} ${rows.length}/${candidates.length}${cut ? " cut" : ""}`);
  }

  return summary;
};
