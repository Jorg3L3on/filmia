import { and, asc, desc, eq, inArray, isNotNull, max, sql } from "drizzle-orm";
import { cache } from "react";
import { catalog, db, listItems, lists, titles, yearTops } from "@/db";
import { scheduleAfterResponse } from "@/lib/after-response";
import { findOrCreateCatalog } from "@/lib/catalog";
import { enrichCatalog } from "@/lib/catalog-enrich";
import { mxToday } from "@/lib/cine-core";
import {
  FIRST_TOP_YEAR,
  rankYearTop,
  voteFloorFor,
  YEAR_TOP_CANDIDATES,
  type YearTopCandidate,
} from "@/lib/cine-top";
import { fetchImdbScore, isOmdbConfigured } from "@/lib/omdb";
import { runPool } from "@/lib/run-pool";
import { discoverTmdb } from "@/lib/tmdb";

const DAY_MS = 24 * 60 * 60 * 1000;
/** A year's top is recomputed weekly (the cron runs daily; this keeps it to Mondays-ish). */
const TOP_STALE_MS = 6.5 * DAY_MS;

export type YearTopSummary =
  | { ok: true; year: number; candidates: number; omdbCalls: number; ranked: number }
  | { ok: false; year: number; error: string };

/** The film's IMDb score, fresh from OMDb when it has an IMDb id; enrichment first when it has none. */
const imdbScoreFor = async (row: typeof catalog.$inferSelect, calls: { omdb: number }): Promise<YearTopCandidate> => {
  let current = row;
  if (!current.imdbId) {
    try {
      calls.omdb += 1;
      await enrichCatalog(current);
      current = (await db.query.catalog.findFirst({ where: eq(catalog.id, row.id) })) ?? current;
    } catch {
      // No IMDb id after all: the film just does not rank this week.
    }
    return { catalogId: current.id, imdbRating: current.imdbRating, imdbVotes: current.imdbVotes };
  }

  calls.omdb += 1;
  const score = await fetchImdbScore(current.imdbId).catch(() => null);
  if (score?.rating != null || score?.votes != null) {
    const patch = {
      ...(score.rating != null ? { imdbRating: score.rating } : {}),
      ...(score.votes != null ? { imdbVotes: score.votes } : {}),
    };
    await db.update(catalog).set(patch).where(eq(catalog.id, current.id));
    return {
      catalogId: current.id,
      imdbRating: score.rating ?? current.imdbRating,
      imdbVotes: score.votes ?? current.imdbVotes,
    };
  }
  return { catalogId: current.id, imdbRating: current.imdbRating, imdbVotes: current.imdbVotes };
};

/**
 * «Lo mejor del año · según IMDb»: the 40 most-voted TMDB films of a release year, scored with
 * OMDb's IMDb rating and votes, ranked over the vote floor. Replaces that year's ten rows only
 * when the ranking came out non-empty (a TMDB/OMDb outage keeps last week's).
 */
export const computeYearTop = async (year: number, now = new Date()): Promise<YearTopSummary> => {
  if (!isOmdbConfigured()) {
    return { ok: false, year, error: "omdb_not_configured" };
  }
  let candidates;
  try {
    const pages = await Promise.all(
      [1, 2].map((page) => discoverTmdb({ year, sortBy: "vote_count.desc", page })),
    );
    candidates = pages.flat().slice(0, YEAR_TOP_CANDIDATES);
  } catch {
    return { ok: false, year, error: "tmdb_failed" };
  }

  const calls = { omdb: 0 };
  const scored: YearTopCandidate[] = [];
  await runPool(candidates, 4, async (candidate) => {
    try {
      const { row } = await findOrCreateCatalog({
        tmdbId: candidate.tmdbId,
        kind: "MOVIE",
        name: candidate.name,
        originalName: candidate.originalName,
        year: candidate.year,
        posterPath: candidate.posterPath,
      });
      scored.push(await imdbScoreFor(row, calls));
    } catch {
      // Skip the film; the rest still rank.
    }
  });

  const ranked = rankYearTop(scored, voteFloorFor(year, mxToday(now)));
  if (ranked.length === 0) {
    return { ok: false, year, error: "no_ranked_films" };
  }

  await db.batch([
    db.delete(yearTops).where(eq(yearTops.year, year)),
    db.insert(yearTops).values(ranked.map((entry) => ({ year, ...entry, computedAt: now }))),
  ]);
  return { ok: true, year, candidates: candidates.length, omdbCalls: calls.omdb, ranked: ranked.length };
};

const lastComputedAt = async (year: number) => {
  const [row] = await db.select({ at: max(yearTops.computedAt) }).from(yearTops).where(eq(yearTops.year, year));
  return row?.at ?? null;
};

/** Years that have a top stored (any size). */
export const getYearsWithTop = cache(async () =>
  (await db.selectDistinct({ year: yearTops.year }).from(yearTops)).map((row) => row.year),
);

/**
 * Cron step: this year and last, when missing or a week old; then one older year that has no top
 * yet, newest first (FIL-I23-1), so «Lo calculamos el {día}» on the pending block holds.
 */
export const refreshYearTops = async (now = new Date()) => {
  const year = Number(mxToday(now).slice(0, 4));
  const results: (YearTopSummary | { ok: true; year: number; skipped: "fresh" })[] = [];
  for (const target of [year, year - 1]) {
    const at = await lastComputedAt(target);
    if (at && now.getTime() - at.getTime() < TOP_STALE_MS) {
      results.push({ ok: true, year: target, skipped: "fresh" });
      continue;
    }
    results.push(await computeYearTop(target, now));
  }
  const stored = new Set(await getYearsWithTop());
  for (let older = year - 2; older >= FIRST_TOP_YEAR; older -= 1) {
    if (!stored.has(older)) {
      results.push(await computeYearTop(older, now));
      break;
    }
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

/** Which of these films the user has seen (for «Vista» and «Has visto n de 10»). */
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
