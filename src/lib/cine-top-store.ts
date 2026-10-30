import { and, asc, count, desc, eq, inArray, isNotNull, max, sql } from "drizzle-orm";
import { cache } from "react";
import { catalog, db, listItems, lists, titles, yearTops } from "@/db";
import { scheduleAfterResponse } from "@/lib/after-response";
import { findOrCreateCatalog } from "@/lib/catalog";
import { enrichCatalog } from "@/lib/catalog-enrich";
import { mxToday } from "@/lib/cine-core";
import {
  LEGACY_IMDB_TOP_SIZE,
  olderTopYears,
  pickScore,
  planYearScores,
  rankYearTop,
  voteFloorFor,
  YEAR_TOP_CANDIDATES,
  YEAR_TOP_OLDER_PER_RUN,
  YEAR_TOP_OMDB_ON_DEMAND,
  YEAR_TOP_OMDB_PER_RUN,
  YEAR_TOP_OMDB_REFRESH,
  type ScorePair,
  type YearTopCandidate,
} from "@/lib/cine-top";
import { readImdbRatingsOrNull, type ImdbRating } from "@/lib/imdb-ratings";
import { fetchImdbScore, isOmdbConfigured } from "@/lib/omdb";
import { runPool } from "@/lib/run-pool";
import { discoverTmdb } from "@/lib/tmdb";

export type ImdbRatings = ReadonlyMap<string, ImdbRating>;

const DAY_MS = 24 * 60 * 60 * 1000;
/** A year's top is recomputed weekly (the cron runs daily; this keeps it to Mondays-ish). */
const TOP_STALE_MS = 6.5 * DAY_MS;

/** TMDB discover pages a year's candidates come from (20 a page). */
const CANDIDATE_PAGES = Math.ceil(YEAR_TOP_CANDIDATES / 20);
/** A run stops starting older years once less than this is left. */
const MIN_BUDGET_FOR_YEAR = 25;

/** OMDb calls left to spend; shared by every year of one run. */
export type OmdbBudget = { left: number };

export type YearTopSummary =
  | { ok: true; year: number; candidates: number; fromDataset: number; omdbCalls: number; ranked: number }
  | { ok: false; year: number; error: string; omdbCalls?: number; skipped?: number };

type CatalogRow = typeof catalog.$inferSelect;

const storedScore = (row: CatalogRow): YearTopCandidate => ({
  catalogId: row.id,
  imdbRating: row.imdbRating,
  imdbVotes: row.imdbVotes,
});

/** Writes the picked score to Catalog when it moved; never a null over a value (`pickScore`). */
const saveScore = async (row: CatalogRow, dataset: ScorePair | null, omdb: ScorePair | null): Promise<YearTopCandidate> => {
  const score = pickScore(dataset, omdb, { rating: row.imdbRating, votes: row.imdbVotes });
  const patch = {
    ...(score.rating != null && score.rating !== row.imdbRating ? { imdbRating: score.rating } : {}),
    ...(score.votes != null && score.votes !== row.imdbVotes ? { imdbVotes: score.votes } : {}),
  };
  if (Object.keys(patch).length > 0) {
    await db.update(catalog).set(patch).where(eq(catalog.id, row.id));
  }
  return { catalogId: row.id, imdbRating: score.rating, imdbVotes: score.votes };
};

/** The film's IMDb score, fresh from OMDb when it has an IMDb id; enrichment first when it has none. */
const imdbScoreFor = async (row: CatalogRow): Promise<YearTopCandidate> => {
  let current = row;
  if (!current.imdbId) {
    try {
      await enrichCatalog(current);
      current = (await db.query.catalog.findFirst({ where: eq(catalog.id, row.id) })) ?? current;
    } catch {
      // No IMDb id after all: the film just does not rank this week.
    }
    return storedScore(current);
  }

  const score = await fetchImdbScore(current.imdbId).catch(() => null);
  return saveScore(current, null, score);
};

export type YearRows = { ok: true; year: number; candidates: number; rows: CatalogRow[] } | { ok: false; year: number; error: string };

/** A year's 300 most-voted TMDB films as Catalog rows, in vote-count order. */
const loadYearRows = async (year: number): Promise<YearRows> => {
  let candidates;
  try {
    const pages = await Promise.all(
      Array.from({ length: CANDIDATE_PAGES }, (_, index) =>
        discoverTmdb({ year, sortBy: "vote_count.desc", page: index + 1 }),
      ),
    );
    candidates = pages.flat().slice(0, YEAR_TOP_CANDIDATES);
  } catch {
    return { ok: false, year, error: "tmdb_failed" };
  }

  const rows: CatalogRow[] = [];
  await runPool(candidates, 6, async (candidate) => {
    try {
      const { row } = await findOrCreateCatalog({
        tmdbId: candidate.tmdbId,
        kind: "MOVIE",
        name: candidate.name,
        originalName: candidate.originalName,
        year: candidate.year,
        posterPath: candidate.posterPath,
      });
      rows.push(row);
    } catch {
      // Skip the film; the rest still rank.
    }
  });
  const order = new Map(candidates.map((candidate, index) => [candidate.tmdbId, index]));
  rows.sort((a, b) => (order.get(a.tmdbId) ?? 0) - (order.get(b.tmdbId) ?? 0));
  return { ok: true, year, candidates: candidates.length, rows };
};

/** IMDb ids worth looking up in the file: every candidate of every year this run computes. */
const imdbIdsOf = (years: readonly YearRows[]) =>
  new Set(years.flatMap((year) => (year.ok ? year.rows.flatMap((row) => (row.imdbId ? [row.imdbId] : [])) : [])));

/**
 * Ranks one year's candidates and stores the top. IMDb's file (`ratings`, null when it could not
 * be read) scores every film it has a row for; OMDb is asked only about the rest, within `budget`
 * (unscored films first, then up to `refresh` stored scores); the others rank on Catalog's score.
 * Replaces that year's rows only when every candidate had its turn and the ranking came out
 * non-empty: an outage or a budget that ran out keeps the stored top, and the scores already
 * fetched make the next run shorter.
 */
const scoreYearTop = async (
  loaded: YearRows,
  ratings: ImdbRatings | null,
  now: Date,
  budget: OmdbBudget,
  refresh: number,
): Promise<YearTopSummary> => {
  if (!loaded.ok) {
    return loaded;
  }
  const { year, rows } = loaded;
  const { fromDataset, ask, skipped } = planYearScores(rows, ratings, budget.left, refresh);
  budget.left -= ask.length;
  const taken = new Set([...ask, ...fromDataset.map((entry) => entry.row)].map((row) => row.id));
  const scored: YearTopCandidate[] = rows.filter((row) => !taken.has(row.id)).map(storedScore);
  await runPool(fromDataset, 6, async ({ row, score }) => {
    try {
      scored.push(await saveScore(row, score, null));
    } catch {
      scored.push(storedScore(row));
    }
  });
  await runPool(ask, 4, async (row) => {
    try {
      scored.push(await imdbScoreFor(row));
    } catch {
      scored.push(storedScore(row));
    }
  });

  if (skipped > 0) {
    return { ok: false, year, error: "omdb_budget", omdbCalls: ask.length, skipped };
  }
  const ranked = rankYearTop(scored, voteFloorFor(year, mxToday(now)));
  if (ranked.length === 0) {
    return { ok: false, year, error: "no_ranked_films", omdbCalls: ask.length };
  }

  await db.batch([
    db.delete(yearTops).where(eq(yearTops.year, year)),
    db.insert(yearTops).values(ranked.map((entry) => ({ year, ...entry, computedAt: now }))),
  ]);
  return {
    ok: true,
    year,
    candidates: loaded.candidates,
    fromDataset: fromDataset.length,
    omdbCalls: ask.length,
    ranked: ranked.length,
  };
};

/**
 * «Lo mejor del año · según IMDb»: the 300 most-voted TMDB films of a release year, ranked by
 * IMDb rating over the vote floor, a hundred at most (scoring in `scoreYearTop`). On its own it
 * reads IMDb's file for this one year; the cron reads it once for all its years instead.
 */
export const computeYearTop = async (
  year: number,
  now = new Date(),
  budget: OmdbBudget = { left: YEAR_TOP_OMDB_ON_DEMAND },
  refresh = 0,
): Promise<YearTopSummary> => {
  if (!isOmdbConfigured()) {
    return { ok: false, year, error: "omdb_not_configured" };
  }
  const loaded = await loadYearRows(year);
  const ratings = loaded.ok ? await readImdbRatingsOrNull(imdbIdsOf([loaded])) : null;
  return scoreYearTop(loaded, ratings, now, budget, refresh);
};

const lastComputedAt = async (year: number) => {
  const [row] = await db.select({ at: max(yearTops.computedAt) }).from(yearTops).where(eq(yearTops.year, year));
  return row?.at ?? null;
};

/** Years that have a top stored (any size). */
export const getYearsWithTop = cache(async () =>
  (await db.selectDistinct({ year: yearTops.year }).from(yearTops)).map((row) => row.year),
);

/** Rows stored per year. */
const getYearTopSizes = async () =>
  new Map(
    (await db.select({ year: yearTops.year, size: count() }).from(yearTops).groupBy(yearTops.year)).map((row) => [
      row.year,
      Number(row.size),
    ]),
  );

/** What the cron step reads and writes through; tests pass fakes. */
const refreshDeps = {
  isOmdbConfigured,
  getYearTopSizes,
  lastComputedAt,
  loadYearRows,
  readRatings: (ids: ReadonlySet<string>) => readImdbRatingsOrNull(ids),
  scoreYearTop,
};
export type RefreshDeps = typeof refreshDeps;

/**
 * Cron step, within one OMDb budget: this year and last, when missing, a week old or still a
 * pre-FIL-I32 ten; then older years with no top, then older tens, newest first, a couple a night
 * and while the budget lasts. IMDb's file is read once for every year the run computes. A year the
 * budget did not finish keeps its stored top and goes on the next night.
 */
export const refreshYearTops = async (
  now = new Date(),
  budget: OmdbBudget = { left: YEAR_TOP_OMDB_PER_RUN },
  deps: RefreshDeps = refreshDeps,
) => {
  const today = mxToday(now);
  const year = Number(today.slice(0, 4));
  if (!deps.isOmdbConfigured()) {
    return [year, year - 1].map((target): YearTopSummary => ({ ok: false, year: target, error: "omdb_not_configured" }));
  }
  const sizes = await deps.getYearTopSizes();
  const results: (YearTopSummary | { ok: true; year: number; skipped: "fresh" | "budget" | "later" })[] = [];
  const recent: number[] = [];
  for (const target of [year, year - 1]) {
    const at = await deps.lastComputedAt(target);
    const legacy = (sizes.get(target) ?? 0) <= LEGACY_IMDB_TOP_SIZE;
    if (at && !legacy && now.getTime() - at.getTime() < TOP_STALE_MS) {
      results.push({ ok: true, year: target, skipped: "fresh" });
    } else {
      recent.push(target);
    }
  }
  const older = olderTopYears(sizes, today);
  const olderNow = older.slice(0, YEAR_TOP_OLDER_PER_RUN);

  const loaded: YearRows[] = [];
  for (const target of [...recent, ...olderNow]) {
    loaded.push(await deps.loadYearRows(target));
  }
  const ids = imdbIdsOf(loaded);
  const ratings = ids.size > 0 ? await deps.readRatings(ids) : null;

  for (const entry of loaded) {
    const isRecent = recent.includes(entry.year);
    if (!isRecent && budget.left < MIN_BUDGET_FOR_YEAR) {
      results.push({ ok: true, year: entry.year, skipped: "budget" });
      return results;
    }
    results.push(await deps.scoreYearTop(entry, ratings, now, budget, isRecent ? YEAR_TOP_OMDB_REFRESH : 0));
  }
  if (older.length > olderNow.length) {
    results.push({ ok: true, year: older[olderNow.length], skipped: "later" });
  }
  return results;
};

const requested = new Set<number>();

/** Older years are computed once, the first time someone opens them (after the response). */
export const requestYearTop = (year: number) => {
  if (requested.has(year)) {
    return;
  }
  requested.add(year);
  scheduleAfterResponse(async () => {
    try {
      const result = await computeYearTop(year);
      if (!result.ok) {
        requested.delete(year);
      }
    } catch {
      requested.delete(year);
    }
  });
};

export type YearTopFilm = {
  rank: number;
  catalogId: string;
  tmdbId: number;
  name: string;
  originalName: string | null;
  year: number | null;
  posterPath: string | null;
  imdbRating: number;
  imdbVotes: number;
};

export const getYearTop = cache(async (year: number): Promise<YearTopFilm[]> =>
  db
    .select({
      rank: yearTops.rank,
      catalogId: yearTops.catalogId,
      tmdbId: catalog.tmdbId,
      name: catalog.name,
      originalName: catalog.originalName,
      year: catalog.year,
      posterPath: catalog.posterPath,
      imdbRating: yearTops.imdbRating,
      imdbVotes: yearTops.imdbVotes,
    })
    .from(yearTops)
    .innerJoin(catalog, eq(catalog.id, yearTops.catalogId))
    .where(eq(yearTops.year, year))
    .orderBy(asc(yearTops.rank)),
);

/** Which of these films the user has seen (for «Vista» and «Has visto n de 100»). */
export const getWatchedCatalogIds = async (userId: string, catalogIds: readonly string[]) => {
  if (catalogIds.length === 0) {
    return new Set<string>();
  }
  const rows = await db
    .select({ catalogId: titles.catalogId })
    .from(titles)
    .where(and(eq(titles.userId, userId), isNotNull(titles.watchedAt), inArray(titles.catalogId, [...catalogIds])));
  return new Set(rows.map((row) => row.catalogId));
};

export type WatchedOfYear = {
  titleId: string;
  tmdbId: number;
  name: string;
  posterPath: string | null;
  rating: number | null;
};

/** Movies of that release year the user saw — what a top can hold — their best-rated first. */
export const getWatchedMoviesOfYear = async (userId: string, year: number): Promise<WatchedOfYear[]> =>
  db
    .select({
      titleId: titles.id,
      tmdbId: catalog.tmdbId,
      name: catalog.name,
      posterPath: catalog.posterPath,
      rating: titles.rating,
    })
    .from(titles)
    .innerJoin(catalog, eq(catalog.id, titles.catalogId))
    .where(
      and(eq(titles.userId, userId), isNotNull(titles.watchedAt), eq(catalog.year, year), eq(catalog.kind, "MOVIE")),
    )
    .orderBy(sql`${titles.rating} DESC NULLS LAST`, desc(titles.watchedAt));

export type UserYearTop = { listId: string; titleIds: string[]; films: WatchedOfYear[] };

/** The user's «Mi top de {año}» list, in order; null when they have not made it. */
export const getUserYearTop = async (userId: string, year: number): Promise<UserYearTop | null> => {
  const list = await db.query.lists.findFirst({
    where: and(eq(lists.userId, userId), eq(lists.kind, "YEAR_TOP"), eq(lists.year, year)),
    columns: { id: true },
  });
  if (!list) {
    return null;
  }
  const films = await db
    .select({
      titleId: titles.id,
      tmdbId: catalog.tmdbId,
      name: catalog.name,
      posterPath: catalog.posterPath,
      rating: titles.rating,
    })
    .from(listItems)
    .innerJoin(titles, and(eq(titles.catalogId, listItems.catalogId), eq(titles.userId, userId)))
    .innerJoin(catalog, eq(catalog.id, listItems.catalogId))
    .where(eq(listItems.listId, list.id))
    .orderBy(asc(listItems.position));
  return { listId: list.id, titleIds: films.map((film) => film.titleId), films };
};
