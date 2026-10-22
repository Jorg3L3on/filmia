import { and, eq, inArray, lt, ne, sql } from "drizzle-orm";
import imcineFile from "../../data/cines-mx.json";
import { catalog, cinemaReleases, db, type CatalogRow } from "@/db";
import { findOrCreateCatalog } from "@/lib/catalog";
import { enrichCatalog } from "@/lib/catalog-enrich";
import {
  addDays,
  GONE_AFTER_DAYS,
  hasLatinLetters,
  HOME_AFTER_DAYS,
  HOME_LOOKBACK_DAYS,
  judgeCinemaCandidate,
  readableTitle,
  mergeRelease,
  mxToday,
  type CinemaVerdict,
  type StoredRelease,
} from "@/lib/cine-core";
import { parseImcineFile, type ImcineIssue } from "@/lib/cine-imcine";
import { runPool } from "@/lib/run-pool";
import {
  discoverTmdbReleaseIds,
  getTmdbMovieReleaseInfo,
  getTmdbMovieTitle,
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
 * P4 (FIL-I23-6): a row whose es-MX name has no Latin letters (TMDB fell back to the original
 * script) gets its en-US title. Names that already read are never touched.
 */
export const ensureReadableTitle = async (row: Pick<CatalogRow, "id" | "tmdbId" | "name">): Promise<string | null> => {
  if (hasLatinLetters(row.name)) {
    return null;
  }
  let enName: string | null = null;
  try {
    enName = await getTmdbMovieTitle(row.tmdbId, "en-US");
  } catch {
    return null;
  }
  const name = readableTitle(row.name, enName);
  if (name === row.name) {
    return null;
  }
  await db.update(catalog).set({ name, updatedAt: new Date() }).where(eq(catalog.id, row.id));
  return name;
};

/** Repair pass over the stored cartelera (any status): how many names were replaced. */
export const repairUnreadableTitles = async () => {
  const rows = await db
    .select({ id: catalog.id, tmdbId: catalog.tmdbId, name: catalog.name })
    .from(cinemaReleases)
    .innerJoin(catalog, eq(catalog.id, cinemaReleases.catalogId));
  let repaired = 0;
  await runPool(
    rows.filter((row) => !hasLatinLetters(row.name)),
    3,
    async (row) => {
      if (await ensureReadableTitle(row)) {
        repaired += 1;
      }
    },
  );
  return { checked: rows.length, repaired };
};

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
  const readable = await ensureReadableTitle(row);
  if (readable) {
    row.name = readable;
  }
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

  const rejected = { no_theatrical: 0, rerelease: 0, unpopular: 0, short: 0 };
  const kept: { info: TmdbMovieReleaseInfo; mxReleaseDate: string }[] = [];
  const rejectedIds: number[] = [];
  for (const info of infos) {
    const verdict = judgeCinemaCandidate({
      tmdbId: info.tmdbId,
      popularity: info.popularity,
      originalLanguage: info.originalLanguage,
      productionCountries: info.productionCountries,
      releaseDate: info.releaseDate,
      runtimeMinutes: info.runtimeMinutes,
      mxReleaseDates: info.releaseDates.MX ?? [],
    });
    if (verdict.ok) {
      kept.push({ info, mxReleaseDate: verdict.mxReleaseDate });
    } else {
      rejected[verdict.reason] += 1;
      rejectedIds.push(info.tmdbId);
    }
  }

  const existing = await loadStoredReleases();
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
    await writeCinemaRelease(
      row.id,
      mergeRelease(existing.get(row.id) ?? null, { mxReleaseDate, popularity: info.popularity, source: "tmdb" }, today),
      now,
    );
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

  // A film TMDB still lists but the filter now turns down (a rule changed, its date moved to
  // limited-only) leaves the cartelera at once — unless IMCINE vouches for it.
  let rejectedGone = 0;
  if (rejectedIds.length > 0) {
    const rows = await db
      .update(cinemaReleases)
      .set({ status: "gone" })
      .where(
        and(
          ne(cinemaReleases.status, "gone"),
          eq(cinemaReleases.source, "tmdb"),
          inArray(
            cinemaReleases.catalogId,
            db.select({ id: catalog.id }).from(catalog).where(and(eq(catalog.kind, "MOVIE"), inArray(catalog.tmdbId, rejectedIds))),
          ),
        ),
      )
      .returning({ catalogId: cinemaReleases.catalogId });
    rejectedGone = rows.length;
  }

  const gone = rejectedGone + (await sweepCinemaReleases(today, now));

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

const loadStoredReleases = async () =>
  new Map<string, StoredRelease>(
    (
      await db
        .select({
          catalogId: cinemaReleases.catalogId,
          mxReleaseDate: cinemaReleases.mxReleaseDate,
          source: cinemaReleases.source,
          popularity: cinemaReleases.popularity,
        })
        .from(cinemaReleases)
    ).map((row) => [
      row.catalogId,
      { mxReleaseDate: row.mxReleaseDate, source: row.source === "imcine" ? "imcine" : "tmdb", popularity: row.popularity },
    ]),
  );

/** Insert or refresh one release with what `mergeRelease` decided; `firstSeenAt` is kept. */
const writeCinemaRelease = async (
  catalogId: string,
  release: StoredRelease & { status: "now" | "upcoming" },
  now: Date,
) => {
  await db
    .insert(cinemaReleases)
    .values({ catalogId, ...release, firstSeenAt: now, lastSeenAt: now })
    .onConflictDoUpdate({
      target: cinemaReleases.catalogId,
      set: { ...release, lastSeenAt: now },
    });
};

export type ImcineSummary = {
  ok: true;
  entries: number;
  applied: number;
  created: number;
  catalogCreated: number;
  skipped: { title: string; reason: string }[];
  invalid: ImcineIssue[];
};

/**
 * IMCINE step (FIL-I17-2): apply `data/cines-mx.json` over TMDB. Its dates win; a film TMDB did
 * not list as a commercial release is created anyway. Runs after the cartelera step and touches
 * `lastSeenAt`, so IMCINE films never age out while they are in the file's window.
 */
export const applyImcineReleases = async (now = new Date(), raw: unknown = imcineFile): Promise<ImcineSummary> => {
  const today = mxToday(now);
  const { releases, issues } = parseImcineFile(raw);
  const existing = await loadStoredReleases();
  const budget = { left: 10, enriched: 0 };
  const summary: ImcineSummary = {
    ok: true,
    entries: releases.length,
    applied: 0,
    created: 0,
    catalogCreated: 0,
    skipped: [],
    invalid: issues,
  };

  await runPool(releases, 3, async (entry) => {
    if (entry.tmdbId == null) {
      summary.skipped.push({ title: entry.title, reason: "sin_tmdb" });
      return;
    }
    // Films more than a quarter past their date are history: leave their rows alone.
    if (entry.mxReleaseDate < addDays(today, -HOME_AFTER_DAYS * 2)) {
      summary.skipped.push({ title: entry.title, reason: "vieja" });
      return;
    }
    let info: TmdbMovieReleaseInfo | null = null;
    try {
      info = await getTmdbMovieReleaseInfo(entry.tmdbId);
    } catch {
      // TMDB down: the file still has a title; popularity stays as stored.
    }
    const { row, created } = await materializeCatalog(
      info ?? { tmdbId: entry.tmdbId, name: entry.title, originalName: null, year: Number(entry.mxReleaseDate.slice(0, 4)), posterPath: null },
      budget,
    );
    if (created) {
      summary.catalogCreated += 1;
    }
    const stored = existing.get(row.id) ?? null;
    if (!stored) {
      summary.created += 1;
    }
    await writeCinemaRelease(
      row.id,
      mergeRelease(
        stored,
        { mxReleaseDate: entry.mxReleaseDate, source: "imcine", popularity: info?.popularity ?? 0 },
        today,
      ),
      now,
    );
    summary.applied += 1;
  });

  return summary;
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

export type BackfillSummary = { ok: true; listed: number; kept: number; created: number; enriched: number; skipped?: string } | { ok: false; error: string };

/** The backfill runs on Mondays, or any day while the «Ya en casa» window is still empty. */
export const shouldBackfill = async (now = new Date()) => {
  if (now.getUTCDay() === 1) {
    return true;
  }
  const today = mxToday(now);
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(cinemaReleases)
    .where(
      and(
        sql`${cinemaReleases.mxReleaseDate} >= ${addDays(today, -HOME_LOOKBACK_DAYS)}::date`,
        sql`${cinemaReleases.mxReleaseDate} < ${addDays(today, -HOME_AFTER_DAYS)}::date`,
      ),
    );
  return (row?.count ?? 0) < 20;
};

/**
 * «Ya en casa» history (FIL-I17-4): commercial MX releases from six months to six weeks ago,
 * stored as `gone` so the page can show which of them stream now. Rows that already exist are
 * left alone; the daily providers cron keeps their availability current.
 */
export const backfillPastReleases = async (now = new Date()): Promise<BackfillSummary> => {
  const today = mxToday(now);
  let ids: number[];
  try {
    ids = await discoverTmdbReleaseIds({
      from: addDays(today, -HOME_LOOKBACK_DAYS),
      to: addDays(today, -HOME_AFTER_DAYS - 1),
      types: "3",
      maxPages: 10,
    });
  } catch {
    return { ok: false, error: "tmdb_lists_failed" };
  }

  const existing = await loadStoredReleases();
  const kept: { info: TmdbMovieReleaseInfo; mxReleaseDate: string }[] = [];
  await runPool(ids, DETAIL_CONCURRENCY, async (tmdbId) => {
    try {
      const info = await getTmdbMovieReleaseInfo(tmdbId);
      if (!info) {
        return;
      }
      const verdict = judgeCinemaCandidate({
        tmdbId: info.tmdbId,
        popularity: info.popularity,
        originalLanguage: info.originalLanguage,
        productionCountries: info.productionCountries,
        releaseDate: info.releaseDate,
        runtimeMinutes: info.runtimeMinutes,
        mxReleaseDates: info.releaseDates.MX ?? [],
      });
      if (verdict.ok) {
        kept.push({ info, mxReleaseDate: verdict.mxReleaseDate });
      }
    } catch {
      // One film failing is fine: next week's run tries it again.
    }
  });

  const budget = { left: MAX_ENRICH_PER_RUN, enriched: 0 };
  let created = 0;
  kept.sort((a, b) => b.info.popularity - a.info.popularity);
  await runPool(kept, ENRICH_CONCURRENCY, async ({ info, mxReleaseDate }) => {
    const { row } = await materializeCatalog(info, budget);
    if (existing.has(row.id)) {
      return;
    }
    const inserted = await db
      .insert(cinemaReleases)
      .values({
        catalogId: row.id,
        mxReleaseDate,
        status: "gone",
        popularity: info.popularity,
        firstSeenAt: now,
        lastSeenAt: now,
        source: "tmdb",
      })
      .onConflictDoNothing()
      .returning({ catalogId: cinemaReleases.catalogId });
    created += inserted.length;
  });

  return { ok: true, listed: ids.length, kept: kept.length, created, enriched: budget.enriched };
};
