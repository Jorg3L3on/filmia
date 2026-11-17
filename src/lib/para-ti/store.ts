import { and, desc, eq, gte, inArray, isNotNull, max } from "drizzle-orm";
import { catalog, db, paraTiPool, pickEvents, users, type TitleKind } from "@/db";
import { loadUserAffinity, ownsFilm } from "@/lib/affinity-store";
import { parseStoredTmdbGenres } from "@/lib/diary-picks";
import type { AntojoId } from "@/lib/para-ti/antojos";
import {
  dailySeed,
  rankParaTi,
  type ParaTiCandidate,
  type ParaTiFilters,
  type ParaTiTitle,
  type RankContext,
} from "@/lib/para-ti/rank";
import { buildShelves, NEW_WINDOW_DAYS, pickAnchor, type Shelf } from "@/lib/para-ti/shelves";
import { parseStoredStreamingPlatforms } from "@/lib/streaming-platforms";
import { getTmdbRelated } from "@/lib/tmdb";
import { parseStoredKeywords, parseStoredPeople } from "@/lib/tonight-store";
import { parseStoredWatchProviders } from "@/lib/watch-providers";

/**
 * Para ti's server reading (FIL-I60-3). The pools are shared, so their parsed rows are kept in
 * memory per instance (10 min, or until the cron writes a newer pool); per request only the
 * person's library, platforms and dismissals are read. No TMDB call except the anchor's
 * «recommendations», which `tmdbFetch` caches for a day.
 */

/** «No me interesa» (FIL-I60-3): a PickEvent of this kind and lens. Hoy reads less_like as a permanent block. */
export const PARA_TI_DISMISS_KIND = "less_like" as const;
export const PARA_TI_LENS = "para-ti";

const CACHE_TTL_MS = 10 * 60 * 1000;

const CANDIDATE_COLUMNS = {
  catalogId: catalog.id,
  tmdbId: catalog.tmdbId,
  kind: catalog.kind,
  name: catalog.name,
  year: catalog.year,
  posterPath: catalog.posterPath,
  posterAmbient: catalog.posterAmbient,
  runtimeMinutes: catalog.runtimeMinutes,
  imdbRating: catalog.imdbRating,
  imdbVotes: catalog.imdbVotes,
  rtScore: catalog.rtScore,
  tmdbGenres: catalog.tmdbGenres,
  tmdbKeywords: catalog.tmdbKeywords,
  tmdbPeople: catalog.tmdbPeople,
  originalLanguage: catalog.originalLanguage,
  watchProvidersMx: catalog.watchProvidersMx,
  availableSince: catalog.availableSince,
} as const;

type CandidateRow = {
  catalogId: string;
  tmdbId: number;
  kind: TitleKind;
  name: string;
  year: number | null;
  posterPath: string | null;
  posterAmbient: string | null;
  runtimeMinutes: number | null;
  imdbRating: number | null;
  imdbVotes: number | null;
  rtScore: number | null;
  tmdbGenres: unknown;
  tmdbKeywords: unknown;
  tmdbPeople: unknown;
  originalLanguage: string | null;
  watchProvidersMx: unknown;
  availableSince: Date | null;
};

const toCandidate = (
  row: CandidateRow,
  pool: { rank: number; voteAverage: number | null; voteCount: number } | null,
): ParaTiCandidate => ({
  catalogId: row.catalogId,
  tmdbId: row.tmdbId,
  kind: row.kind,
  name: row.name,
  year: row.year,
  posterPath: row.posterPath,
  posterAmbient: row.posterAmbient,
  runtimeMinutes: row.runtimeMinutes,
  imdbRating: row.imdbRating,
  imdbVotes: row.imdbVotes,
  rtScore: row.rtScore,
  voteAverage: pool?.voteAverage ?? null,
  voteCount: pool?.voteCount ?? 0,
  poolRank: pool?.rank ?? 50,
  genres: parseStoredTmdbGenres(row.tmdbGenres),
  keywords: parseStoredKeywords(row.tmdbKeywords),
  people: parseStoredPeople(row.tmdbPeople),
  originalLanguage: row.originalLanguage,
  providers: parseStoredWatchProviders(row.watchProvidersMx),
  availableSince: row.availableSince,
});

type PoolEntry = ParaTiCandidate & { antojo: AntojoId };

let poolCache: { at: number; version: number; rows: PoolEntry[] } | null = null;

const poolVersion = async () => {
  const [row] = await db.select({ at: max(paraTiPool.fetchedAt) }).from(paraTiPool);
  return row?.at?.getTime() ?? 0;
};

/** Every pool row, parsed: one shared read per instance while the pools do not change. */
const loadPools = async (): Promise<PoolEntry[]> => {
  const version = await poolVersion();
  if (poolCache && poolCache.version === version && Date.now() - poolCache.at < CACHE_TTL_MS) {
    return poolCache.rows;
  }
  const rows = await db
    .select({
      ...CANDIDATE_COLUMNS,
      antojo: paraTiPool.antojo,
      rank: paraTiPool.rank,
      voteAverage: paraTiPool.voteAverage,
      voteCount: paraTiPool.voteCount,
    })
    .from(paraTiPool)
    .innerJoin(catalog, eq(catalog.id, paraTiPool.catalogId));
  const parsed = rows.map((row) => ({ ...toCandidate(row, row), antojo: row.antojo as AntojoId }));
  poolCache = { at: Date.now(), version, rows: parsed };
  return parsed;
};

let arrivalsCache: { at: number; rows: ParaTiCandidate[] } | null = null;

/** Catalog rows that arrived on a platform lately (the watch-providers cron stamps `availableSince`). */
const loadArrivals = async (now: Date): Promise<ParaTiCandidate[]> => {
  if (arrivalsCache && Date.now() - arrivalsCache.at < CACHE_TTL_MS) {
    return arrivalsCache.rows;
  }
  const since = new Date(now.getTime() - NEW_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const rows = await db
    .select(CANDIDATE_COLUMNS)
    .from(catalog)
    .where(and(isNotNull(catalog.availableSince), gte(catalog.availableSince, since), isNotNull(catalog.posterPath)))
    .orderBy(desc(catalog.availableSince))
    .limit(300);
  const parsed = rows.map((row) => toCandidate(row, null));
  arrivalsCache = { at: Date.now(), rows: parsed };
  return parsed;
};

/** Forget the shared caches (tests, and the fill script). */
export const forgetParaTiCaches = () => {
  poolCache = null;
  arrivalsCache = null;
};

/** Catalog ids the person dismissed with «No me interesa» (or «Menos así» anywhere): never shown again. */
const loadDismissed = async (userId: string) => {
  const rows = await db
    .select({ catalogId: pickEvents.catalogId })
    .from(pickEvents)
    .where(and(eq(pickEvents.userId, userId), eq(pickEvents.kind, PARA_TI_DISMISS_KIND), isNotNull(pickEvents.catalogId)));
  return new Set(rows.flatMap((row) => (row.catalogId ? [row.catalogId] : [])));
};

const loadPlatforms = async (userId: string) => {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { streamingPlatforms: true } });
  return parseStoredStreamingPlatforms(user?.streamingPlatforms);
};

type Reader = {
  context: RankContext;
  /** No platforms saved: everything shows, and the page explains (MinePlatformsNotice). */
  noPlatforms: boolean;
  cold: boolean;
  user: Awaited<ReturnType<typeof loadUserAffinity>>;
};

const reader = async (userId: string, filters: ParaTiFilters, now: Date, candidates: () => Promise<readonly ParaTiCandidate[]>) => {
  const [user, platforms, dismissed, pool] = await Promise.all([
    loadUserAffinity(userId),
    loadPlatforms(userId),
    loadDismissed(userId),
    candidates(),
  ]);
  const excluded = new Set(dismissed);
  for (const candidate of pool) {
    if (ownsFilm(user, candidate.kind, candidate.tmdbId)) excluded.add(candidate.catalogId);
  }
  const result: Reader = {
    context: { excluded, userPlatforms: platforms, filters, scorer: user.scorer, seed: dailySeed(userId, now) },
    noPlatforms: platforms.length === 0,
    cold: user.scorer == null,
    user,
  };
  return { ...result, pool };
};

export type AntojoReading = {
  titles: ParaTiTitle[];
  noPlatforms: boolean;
  cold: boolean;
  /** How many would show with «Solo mis plataformas» off (for the empty state's offer). */
  withAllPlatforms: number;
};

/** One antojo's titles for one person: up to 40, ranked. */
export const loadAntojoTitles = async (
  userId: string,
  antojo: AntojoId,
  filters: ParaTiFilters,
  now = new Date(),
): Promise<AntojoReading> => {
  const { context, noPlatforms, cold, pool } = await reader(userId, filters, now, async () =>
    (await loadPools()).filter((row) => row.antojo === antojo),
  );
  const titles = rankParaTi(pool, context);
  const withAllPlatforms =
    titles.length === 0 && filters.onlyMine
      ? rankParaTi(pool, { ...context, filters: { ...filters, onlyMine: false } }).length
      : titles.length;
  return { titles, noPlatforms, cold, withAllPlatforms };
};

export type ShelvesReading = { shelves: Shelf[]; noPlatforms: boolean; cold: boolean };

/** The three ready shelves of the opening screen. */
export const loadParaTiShelves = async (userId: string, filters: ParaTiFilters, now = new Date()): Promise<ShelvesReading> => {
  const arrivals = await loadArrivals(now);
  const { context, noPlatforms, cold, user, pool } = await reader(userId, filters, now, async () => [
    ...(await loadPools()),
    ...arrivals,
  ]);
  const anchor = user.scorer ? pickAnchor(user.liked, context.seed) : null;
  let related = new Set<number>();
  if (anchor) {
    try {
      const hits = await getTmdbRelated(anchor.tmdbId, anchor.kind, "recommendations");
      related = new Set(hits.map((hit) => hit.tmdbId));
    } catch {
      // Without TMDB the shelf still orders by likeness to the anchor.
    }
  }
  const pools = pool as PoolEntry[];
  const shelves = buildShelves(
    {
      pool: pools.filter((row) => "antojo" in row),
      joyas: pools.filter((row) => row.antojo === "joya"),
      arrivals,
      anchor,
      related,
      now,
    },
    context,
  );
  return { shelves, noPlatforms, cold };
};

/** Whether a catalog row exists (the dismiss action refuses made-up ids). */
export const catalogExists = async (catalogId: string) =>
  (await db.select({ id: catalog.id }).from(catalog).where(inArray(catalog.id, [catalogId])).limit(1)).length > 0;
