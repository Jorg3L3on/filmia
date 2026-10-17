import { and, eq, inArray, lt, ne, sql } from "drizzle-orm";
import { catalog, cinemaReleases, db, type CatalogRow } from "@/db";
import { findOrCreateCatalog } from "@/lib/catalog";
import { enrichCatalog } from "@/lib/catalog-enrich";
import {
  addDays,
  GONE_AFTER_DAYS,
  HOME_AFTER_DAYS,
  judgeCinemaCandidate,
  mxToday,
  type CinemaVerdict,
} from "@/lib/cine-core";
import { runPool } from "@/lib/run-pool";
import {
  discoverTmdbReleaseIds,
  getTmdbMovieReleaseInfo,
  getTmdbNowPlayingIds,
  type TmdbMovieReleaseInfo,
} from "@/lib/tmdb";

/** New catalog rows enriched per run (details, credits, OMDb, providers); the rest next night. */
const MAX_ENRICH_PER_RUN = 40;
const DETAIL_CONCURRENCY = 6;
const ENRICH_CONCURRENCY = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

export type CarteleraSummary =
  | { ok: false; error: string }
  | {
      ok: true;
      listed: number;
      checked: number;
      kept: number;
      rejected: Record<Exclude<CinemaVerdict, { ok: true }>["reason"], number>;
      failed: number;
      created: number;
      updated: number;
      catalogCreated: number;
      enriched: number;
      gone: number;
      totals: { now: number; upcoming: number; gone: number };
    };

/** A catalog row that only holds the search snapshot (never went through `enrichCatalog`). */
export const needsEnrichment = (row: Pick<CatalogRow, "overview" | "runtimeMinutes" | "tmdbGenres">) =>
  !row.overview && !row.runtimeMinutes && (!Array.isArray(row.tmdbGenres) || row.tmdbGenres.length === 0);

/**
 * Materialize a film the cron decided to show: its shared Catalog row (never overwritten) and,
 * within the run's budget, its enrichment. Returns the row and whether it was new.
 */
export const materializeCatalog = async (
  info: Pick<TmdbMovieReleaseInfo, "tmdbId" | "name" | "originalName" | "year" | "posterPath">,
  budget: { left: number; enriched: number },
) => {
  const { row, created } = await findOrCreateCatalog({
    tmdbId: info.tmdbId,
    kind: "MOVIE",
    name: info.name,
    originalName: info.originalName,
    year: info.year,
    posterPath: info.posterPath,
  });
  if ((created || needsEnrichment(row)) && budget.left > 0) {
    budget.left -= 1;
    try {
      if (await enrichCatalog(row)) {
        budget.enriched += 1;
      }
    } catch {
      // The row exists with the TMDB snapshot; the next run tries again.
    }
  }
  return { row, created };
};

export const countCinemaReleases = async () => {
  const rows = await db
    .select({ status: cinemaReleases.status, count: sql<number>`count(*)::int` })
    .from(cinemaReleases)
    .groupBy(cinemaReleases.status);
  const totals = { now: 0, upcoming: 0, gone: 0 };
  for (const row of rows) {
    if (row.status === "now" || row.status === "upcoming" || row.status === "gone") {
      totals[row.status] = row.count;
    }
  }
  return totals;
};

/**
 * Daily cartelera step: TMDB now_playing (MX) + discover MX (types 2|3 from today to Dec 31,
 * type 3 back six weeks) → per-film release dates → filter → Catalog + CinemaRelease. If a TMDB
 * list cannot be read the table is left as it was (the pages keep yesterday's cartelera).
 */
export const refreshCinemaReleases = async (now = new Date()): Promise<CarteleraSummary> => {
  const today = mxToday(now);
  let ids: number[];
  try {
    const [nowPlaying, upcoming, recent] = await Promise.all([
      getTmdbNowPlayingIds("MX"),
      discoverTmdbReleaseIds({ from: today, to: `${today.slice(0, 4)}-12-31`, types: "2|3" }),
      discoverTmdbReleaseIds({ from: addDays(today, -HOME_AFTER_DAYS), to: today, types: "3" }),
    ]);
    ids = [...new Set([...nowPlaying, ...upcoming, ...recent])];
  } catch {
    return { ok: false, error: "tmdb_lists_failed" };
  }
  if (ids.length === 0) {
    return { ok: false, error: "tmdb_lists_empty" };
  }

  const infos: TmdbMovieReleaseInfo[] = [];
  const failedIds: number[] = [];
  await runPool(ids, DETAIL_CONCURRENCY, async (tmdbId) => {
    try {
      const info = await getTmdbMovieReleaseInfo(tmdbId);
      if (info) {
        infos.push(info);
      }
    } catch {
      failedIds.push(tmdbId);
    }
  });
  if (infos.length === 0) {
    return { ok: false, error: "tmdb_details_failed" };
  }

  const rejected = { no_theatrical: 0, rerelease: 0, unpopular: 0 };
  const kept: { info: TmdbMovieReleaseInfo; mxReleaseDate: string }[] = [];
  for (const info of infos) {
    const verdict = judgeCinemaCandidate({
      tmdbId: info.tmdbId,
      popularity: info.popularity,
      originalLanguage: info.originalLanguage,
      productionCountries: info.productionCountries,
      releaseDate: info.releaseDate,
      mxReleaseDates: info.releaseDates.MX ?? [],
    });
    if (verdict.ok) {
      kept.push({ info, mxReleaseDate: verdict.mxReleaseDate });
    } else {
      rejected[verdict.reason] += 1;
    }
  }

  const existing = new Set(
    (await db.select({ catalogId: cinemaReleases.catalogId }).from(cinemaReleases)).map((row) => row.catalogId),
  );
  const budget = { left: MAX_ENRICH_PER_RUN, enriched: 0 };
  let catalogCreated = 0;
  let created = 0;
  let updated = 0;

  // Popular films first, so the enrichment budget goes where people look.
  kept.sort((a, b) => b.info.popularity - a.info.popularity);
  await runPool(kept, ENRICH_CONCURRENCY, async ({ info, mxReleaseDate }) => {
    const { row, created: newCatalog } = await materializeCatalog(info, budget);
    if (newCatalog) {
      catalogCreated += 1;
    }
    await upsertCinemaRelease({
      catalogId: row.id,
      mxReleaseDate,
      popularity: info.popularity,
      source: "tmdb",
      today,
      now,
    });
    if (existing.has(row.id)) {
      updated += 1;
    } else {
      created += 1;
    }
  });

  // A TMDB hiccup on one film must not age it out: touch the rows we could not check.
  if (failedIds.length > 0) {
    const failedCatalog = await db
      .select({ id: catalog.id })
      .from(catalog)
      .where(and(eq(catalog.kind, "MOVIE"), inArray(catalog.tmdbId, failedIds)));
    if (failedCatalog.length > 0) {
      await db
        .update(cinemaReleases)
        .set({ lastSeenAt: now })
        .where(
          and(
            inArray(
              cinemaReleases.catalogId,
              failedCatalog.map((row) => row.id),
            ),
            ne(cinemaReleases.status, "gone"),
          ),
        );
    }
  }

  const gone = await sweepCinemaReleases(today, now);

  return {
    ok: true,
    listed: ids.length,
    checked: infos.length,
    kept: kept.length,
    rejected,
    failed: failedIds.length,
    created,
    updated,
    catalogCreated,
    enriched: budget.enriched,
    gone,
    totals: await countCinemaReleases(),
  };
};

/**
 * Insert or refresh one release. An IMCINE date is never replaced by TMDB's; the status always
 * follows the effective date. A `gone` film that TMDB lists again comes back.
 */
export const upsertCinemaRelease = async (input: {
  catalogId: string;
  mxReleaseDate: string;
  popularity: number;
  source: "tmdb" | "imcine";
  today: string;
  now: Date;
}) => {
  const status = input.mxReleaseDate <= input.today ? "now" : "upcoming";
  const keepImcine = input.source === "tmdb";
  const effectiveDate = keepImcine
    ? sql`CASE WHEN ${cinemaReleases.source} = 'imcine' THEN ${cinemaReleases.mxReleaseDate} ELSE excluded."mxReleaseDate" END`
    : sql`excluded."mxReleaseDate"`;
  await db
    .insert(cinemaReleases)
    .values({
      catalogId: input.catalogId,
      mxReleaseDate: input.mxReleaseDate,
      status,
      popularity: input.popularity,
      firstSeenAt: input.now,
      lastSeenAt: input.now,
      source: input.source,
    })
    .onConflictDoUpdate({
      target: cinemaReleases.catalogId,
      set: {
        mxReleaseDate: effectiveDate,
        status: sql`CASE WHEN (${effectiveDate}) <= ${input.today}::date THEN 'now' ELSE 'upcoming' END`,
        popularity: keepImcine ? sql`excluded."popularity"` : sql`GREATEST(${cinemaReleases.popularity}, excluded."popularity")`,
        lastSeenAt: input.now,
        source: keepImcine ? sql`${cinemaReleases.source}` : sql`'imcine'`,
      },
    });
};

/** Upcoming films whose day came turn `now`; rows unseen for GONE_AFTER_DAYS turn `gone`. */
export const sweepCinemaReleases = async (today: string, now = new Date()) => {
  await db
    .update(cinemaReleases)
    .set({ status: "now" })
    .where(and(eq(cinemaReleases.status, "upcoming"), sql`${cinemaReleases.mxReleaseDate} <= ${today}::date`));
  const gone = await db
    .update(cinemaReleases)
    .set({ status: "gone" })
    .where(
      and(
        ne(cinemaReleases.status, "gone"),
        lt(cinemaReleases.lastSeenAt, new Date(now.getTime() - GONE_AFTER_DAYS * DAY_MS)),
      ),
    )
    .returning({ catalogId: cinemaReleases.catalogId });
  return gone.length;
};
