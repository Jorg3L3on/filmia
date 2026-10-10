import { eq, inArray } from "drizzle-orm";
import { catalog, db, tonightRecos, type CatalogRow, type Platform } from "@/db";
import { findOrCreateCatalog } from "@/lib/catalog";
import { enrichCatalog } from "@/lib/catalog-enrich";
import { parseStoredTmdbGenres } from "@/lib/diary-picks";
import { runPool } from "@/lib/run-pool";
import { titleAvailableOnUserPlatforms, userStreamingProviderIds } from "@/lib/streaming-platforms";
import { discoverTmdb, getTmdbDetails, getTmdbRelated } from "@/lib/tmdb";
import {
  blockedItemIds,
  candidateKey,
  DISCOVER_MIN_VOTES,
  discoverKinds,
  excludeCandidates,
  mergeCandidates,
  pickSeeds,
  prefilterCandidates,
  SCORE_CAP,
  topGenreIds,
  type CandidateBatch,
  type ListedTitle,
} from "@/lib/tonight/candidates";
import { buildTasteProfile, withQueueTaste } from "@/lib/tonight/profile";
import { RECO_POOL_SIZE, scoreRecos, type RecoInput } from "@/lib/tonight/reco";
import type { RecoCandidate, RecoPick, TonightTitle } from "@/lib/tonight/types";
import { loadTonightInput, parseStoredKeywords, parseStoredPeople } from "@/lib/tonight-store";
import { fetchMxWatchProviders, parseStoredWatchProviders } from "@/lib/watch-providers";

const CONCURRENCY = 6;
/** Providers are checked only for the best of what scored: about 6 in 10 pass. */
const AVAILABILITY_CHECK = 60;
/** New Catalog rows (and enrichments) one user's run may cause. */
export const MAX_NEW_CATALOG_PER_RUN = 40;

type TonightInputLoaded = Awaited<ReturnType<typeof loadTonightInput>>;

export type RecoPoolStats = {
  seeds: number;
  listed: number;
  scored: number;
  checked: number;
  available: number;
  materialized: number;
  listFailures: number;
};

export type RecoPoolResult = {
  /** False when TMDB could not be reached at all: keep the previous pool. */
  ok: boolean;
  picks: RecoPick[];
  stats: RecoPoolStats;
};

const emptyStats = (): RecoPoolStats => ({
  seeds: 0,
  listed: 0,
  scored: 0,
  checked: 0,
  available: 0,
  materialized: 0,
  listFailures: 0,
});

const hasTaste = (row: CatalogRow) =>
  parseStoredKeywords(row.tmdbKeywords).length > 0 || parseStoredPeople(row.tmdbPeople).length > 0;

/** The candidate as the engine reads a title: from Catalog when it is enriched, else TMDB details. */
const toRecoTitle = async (
  candidate: RecoCandidate,
  row: CatalogRow | undefined,
): Promise<TonightTitle | null> => {
  const base = {
    id: candidate.catalogId,
    name: candidate.name,
    kind: candidate.kind,
    year: candidate.year,
    platform: null,
    flatrate: [],
    availableOnMine: true,
    watchedAt: null,
    rating: null,
    review: null,
    seriesStatus: null,
    seriesSeason: null,
    listSlugs: [],
    availableSince: row?.availableSince ?? null,
    createdAt: row?.createdAt ?? new Date(),
  } satisfies Partial<TonightTitle>;

  if (row && hasTaste(row)) {
    return {
      ...base,
      runtimeMinutes: row.runtimeMinutes,
      imdbRating: row.imdbRating ?? candidate.voteAverage,
      imdbVotes: row.imdbVotes ?? candidate.voteCount,
      genres: parseStoredTmdbGenres(row.tmdbGenres),
      keywords: parseStoredKeywords(row.tmdbKeywords),
      people: parseStoredPeople(row.tmdbPeople),
      originalLanguage: row.originalLanguage,
    };
  }

  try {
    const details = await getTmdbDetails(candidate.tmdbId, candidate.kind);
    return {
      ...base,
      runtimeMinutes: details.runtimeMinutes,
      // TMDB's average stands in for IMDb until OMDb has seen the film.
      imdbRating: candidate.voteAverage,
      imdbVotes: candidate.voteCount,
      genres: details.genres,
      keywords: details.keywords,
      people: parseStoredPeople(details.people),
      originalLanguage: details.originalLanguage,
    };
  } catch {
    return null;
  }
};

const listBatches = async (
  input: TonightInputLoaded,
  seeds: ReturnType<typeof pickSeeds>,
  genreIds: number[],
  stats: RecoPoolStats,
): Promise<CandidateBatch[]> => {
  const batches: CandidateBatch[] = [];
  const jobs: Array<() => Promise<void>> = [];
  let attempted = 0;

  const run = async (load: () => Promise<readonly ListedTitle[]>, batch: Omit<CandidateBatch, "items">) => {
    attempted += 1;
    try {
      batches.push({ ...batch, items: await load() });
    } catch {
      stats.listFailures += 1;
    }
  };

  for (const seed of seeds) {
    jobs.push(() =>
      run(() => getTmdbRelated(seed.tmdbId, seed.kind, "recommendations"), {
        sourceKind: "recommendations",
        seed,
      }),
    );
  }

  const providerIds = userStreamingProviderIds(input.userPlatforms as Platform[]);
  if (providerIds.length > 0) {
    for (const kind of discoverKinds(seeds)) {
      for (const genreId of genreIds) {
        jobs.push(() =>
          run(
            () =>
              discoverTmdb({
                kind,
                withGenres: [genreId],
                voteCountGte: DISCOVER_MIN_VOTES,
                withWatchProviders: providerIds,
                watchRegion: "MX",
              }),
            { sourceKind: "discover", seed: null },
          ),
        );
      }
    }
  }

  await runPool(jobs, CONCURRENCY, (job) => job());
  // Every list failing means TMDB is down (or the key is): say so instead of "no recommendations".
  if (attempted > 0 && stats.listFailures === attempted) {
    throw new Error("TMDB no respondió a ninguna lista de candidatas.");
  }
  return batches;
};

/**
 * The recommended pool for one user, ranked: TMDB candidates from the library as seeds and
 * from genre discovery on their platforms, minus everything they own or pushed away,
 * scored by the Esta noche engine, kept only when they stream on the user's MX platforms.
 * Only the films it returns are added to Catalog. Needs the network: run it from the cron,
 * never while serving Hoy.
 */
export const buildRecoPool = async (
  input: TonightInputLoaded,
  options: { poolSize?: number; maxScored?: number; maxNewCatalog?: number } = {},
): Promise<RecoPoolResult> => {
  const { now } = input;
  const stats = emptyStats();
  const poolSize = options.poolSize ?? RECO_POOL_SIZE;
  const maxNewCatalog = options.maxNewCatalog ?? MAX_NEW_CATALOG_PER_RUN;

  const refs = new Map(
    input.rows.map((row) => [row.id, { tmdbId: row.tmdbId, catalogId: row.catalogId }]),
  );
  const titlesById = new Map(input.titles.map((title) => [title.id, title]));
  const queuedTitles = input.queue.flatMap((entry) => {
    const title = titlesById.get(entry.titleId);
    return title && title.watchedAt == null ? [{ title, addedAt: entry.addedAt }] : [];
  });
  const profile = withQueueTaste(buildTasteProfile(input.titles, input.events, now), queuedTitles, now);
  const seeds = pickSeeds({ titles: input.titles, queue: input.queue, refs });
  stats.seeds = seeds.length;
  if (seeds.length === 0 || profile.vector.size === 0) {
    return { ok: true, picks: [], stats };
  }

  let batches: CandidateBatch[];
  try {
    batches = await listBatches(input, seeds, topGenreIds(profile.genreAffinity), stats);
  } catch {
    return { ok: false, picks: [], stats };
  }

  const libraryKeys = new Set(input.rows.map((row) => candidateKey(row.kind, row.tmdbId)));
  const candidates = excludeCandidates(mergeCandidates(batches), {
    libraryKeys,
    blockedIds: blockedItemIds(input.events, now),
  });
  stats.listed = candidates.size;
  const shortlist = prefilterCandidates(candidates, profile.genreAffinity, options.maxScored ?? SCORE_CAP);

  const tmdbIds = [...new Set(shortlist.map((candidate) => candidate.tmdbId))];
  const knownRows = tmdbIds.length
    ? await db.query.catalog.findMany({ where: inArray(catalog.tmdbId, tmdbIds) })
    : [];
  const rowByKey = new Map(knownRows.map((row) => [candidateKey(row.kind, row.tmdbId), row]));

  const scoredInputs: RecoInput[] = [];
  await runPool(shortlist, CONCURRENCY, async (candidate) => {
    const title = await toRecoTitle(candidate, rowByKey.get(candidate.key));
    if (title) {
      scoredInputs.push({ candidate, title });
    }
  });
  stats.scored = scoredInputs.length;

  const ranked = scoreRecos({
    inputs: scoredInputs,
    profile,
    titlesById,
    events: input.events,
    now,
  });

  // Streaming check on the best only. Discover already filtered by provider; a seed's
  // /recommendations list did not, so those need the film's MX offers.
  const userPlatforms = input.userPlatforms as Platform[];
  const checked = ranked.slice(0, AVAILABILITY_CHECK);
  stats.checked = checked.length;
  const available = new Set<string>();
  await runPool(checked, CONCURRENCY, async (pick) => {
    if (pick.candidate.sources.some((source) => source.kind === "discover")) {
      available.add(pick.catalogId);
      return;
    }
    const stored = parseStoredWatchProviders(rowByKey.get(pick.candidate.key)?.watchProvidersMx);
    try {
      const providers = stored ?? (await fetchMxWatchProviders(pick.candidate.tmdbId, pick.candidate.kind));
      if (titleAvailableOnUserPlatforms(providers, userPlatforms)) {
        available.add(pick.catalogId);
      }
    } catch {
      // Unknown availability is not availability: the film is simply skipped tonight.
    }
  });
  const chosen = checked.filter((pick) => available.has(pick.catalogId)).slice(0, poolSize);
  stats.available = available.size;

  // Only what we will show becomes a shared Catalog row (and gets enriched once).
  let spent = 0;
  const materialized: RecoPick[] = [];
  await runPool(chosen, 4, async (pick) => {
    const { row, created } = await findOrCreateCatalog({
      tmdbId: pick.candidate.tmdbId,
      kind: pick.candidate.kind,
      name: pick.candidate.name,
      originalName: pick.candidate.originalName,
      year: pick.candidate.year,
      posterPath: pick.candidate.posterPath,
    });
    if ((created || !hasTaste(row)) && spent < maxNewCatalog) {
      spent += 1;
      try {
        await enrichCatalog(row);
      } catch {
        // The row exists with the search snapshot; the next run tries again.
      }
    }
    if (created) {
      stats.materialized += 1;
    }
    materialized.push(pick);
  });

  const order = new Map(chosen.map((pick, index) => [pick.catalogId, index]));
  materialized.sort((a, b) => (order.get(a.catalogId) ?? 0) - (order.get(b.catalogId) ?? 0));
  return { ok: true, picks: materialized, stats };
};

/** Replace the user's pool (one atomic batch). An empty pool clears it. */
export const persistRecoPool = async (userId: string, picks: readonly RecoPick[], computedAt: Date) => {
  const clear = db.delete(tonightRecos).where(eq(tonightRecos.userId, userId));
  if (picks.length === 0) {
    await clear;
    return;
  }
  await db.batch([
    clear,
    db.insert(tonightRecos).values(
      picks.map((pick, rank) => ({
        userId,
        catalogId: pick.catalogId,
        rank,
        score: pick.baseScore,
        components: pick.components,
        reasons: pick.reasons,
        sourceKind: pick.sourceKind,
        seedCatalogId: pick.seed?.catalogId ?? null,
        seedName: pick.seed?.name ?? null,
        computedAt,
      })),
    ),
  ]);
};

/** Recompute one user's pool and store it. A TMDB outage keeps the previous pool. */
export const computeRecosForUser = async (userId: string, now = new Date()) => {
  const input = await loadTonightInput(userId, now);
  const result = await buildRecoPool(input);
  if (result.ok) {
    await persistRecoPool(userId, result.picks, now);
  }
  return result;
};
