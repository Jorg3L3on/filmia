/**
 * Lo mejor del año (FIL-I17-5, 100 since FIL-I32), the pure half: the IMDb ranking with its vote
 * floor and OMDb budget, which year Cine opens on, and the rules of «Tu top 10 de {año}».
 */

import { addDays, formatShortDay, ticketStub } from "@/lib/cine-core";

/** «Tu top 10 de {año}»: the user's own list. */
export const YEAR_TOP_SIZE = 10;
/** «Lo mejor del año · según IMDb»: rows stored per year. */
export const IMDB_YEAR_TOP_SIZE = 100;
/** Tops stored before FIL-I32 hold at most this many rows; the cron recomputes them. */
export const LEGACY_IMDB_TOP_SIZE = 10;
/** From this many films seen a top is worth making; below it the card nudges. */
export const YEAR_TOP_MIN_PICKS = 3;
/** TMDB candidates per year, by vote count (15 discover pages). */
export const YEAR_TOP_CANDIDATES = 300;
/** OMDb calls one cron run may spend on tops, all years together (OMDb's free tier is 1000 a day). */
export const YEAR_TOP_OMDB_PER_RUN = 500;
/**
 * Older years one cron run computes (FIL-I35). OMDb's budget used to hold it to one or two; with
 * IMDb's file it barely spends any, and each year still costs 15 TMDB pages and 300 Catalog rows.
 */
export const YEAR_TOP_OLDER_PER_RUN = 2;
/** OMDb calls opening a year without a top may spend (after the response). */
export const YEAR_TOP_OMDB_ON_DEMAND = 150;
/** Stored scores re-asked per year, most voted first: only this year and last move. */
export const YEAR_TOP_OMDB_REFRESH = 100;
export const VOTE_FLOOR = 25_000;
/** The year in progress has few votes until mid-year. */
export const VOTE_FLOOR_EARLY = 10_000;
/** Oldest year the selector offers. */
export const FIRST_TOP_YEAR = 2015;

export type YearTopCandidate = { catalogId: string; imdbRating: number | null; imdbVotes: number | null };
export type RankedYearTop = { catalogId: string; rank: number; imdbRating: number; imdbVotes: number };

const yearOf = (today: string) => Number(today.slice(0, 4));
const monthOf = (today: string) => Number(today.slice(5, 7));

export const voteFloorFor = (year: number, today: string) =>
  year === yearOf(today) && monthOf(today) <= 6 ? VOTE_FLOOR_EARLY : VOTE_FLOOR;

/** By IMDb rating, ties to the most voted; only films over the floor; a hundred at most. */
export const rankYearTop = (candidates: readonly YearTopCandidate[], floor: number): RankedYearTop[] =>
  candidates
    .flatMap((candidate) =>
      candidate.imdbRating != null && candidate.imdbVotes != null && candidate.imdbVotes >= floor
        ? [{ catalogId: candidate.catalogId, imdbRating: candidate.imdbRating, imdbVotes: candidate.imdbVotes }]
        : [],
    )
    .sort((a, b) => b.imdbRating - a.imdbRating || b.imdbVotes - a.imdbVotes)
    .filter((entry, index, all) => all.findIndex((other) => other.catalogId === entry.catalogId) === index)
    .slice(0, IMDB_YEAR_TOP_SIZE)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));

/**
 * Which candidates OMDb is asked about this run, in their vote-count order: every one without a
 * score first, then stored scores to refresh, all within `budget`. `skipped` counts the unscored
 * ones left for the next run: a year with any is not complete.
 */
export const planOmdbCalls = <T extends { imdbRating: number | null; imdbVotes: number | null }>(
  rows: readonly T[],
  budget: number,
  refresh: number,
) => {
  const unscored = rows.filter((row) => row.imdbRating == null || row.imdbVotes == null);
  const scored = rows.filter((row) => row.imdbRating != null && row.imdbVotes != null);
  const room = Math.max(0, budget);
  const missing = unscored.slice(0, room);
  const again = scored.slice(0, Math.max(0, Math.min(refresh, room - missing.length)));
  return { ask: [...missing, ...again], skipped: unscored.length - missing.length };
};

/** A rating and vote count; either may be missing. */
export type ScorePair = { rating: number | null; votes: number | null };

/**
 * Which score a candidate ranks on (FIL-I35): IMDb's file when it has the row, OMDb when it
 * answered, else what Catalog already holds. Field by field, so a null never replaces a value.
 */
export const pickScore = (
  dataset: ScorePair | null | undefined,
  omdb: ScorePair | null | undefined,
  stored: ScorePair,
): ScorePair => ({
  rating: dataset?.rating ?? omdb?.rating ?? stored.rating,
  votes: dataset?.votes ?? omdb?.votes ?? stored.votes,
});

/**
 * One year's scoring plan: candidates IMDb's file has a row for take it and skip OMDb; the rest
 * go through `planOmdbCalls` as before. With no file (`ratings` null) it is exactly today's plan.
 */
export const planYearScores = <T extends { imdbId: string | null; imdbRating: number | null; imdbVotes: number | null }>(
  rows: readonly T[],
  ratings: ReadonlyMap<string, { rating: number; votes: number }> | null,
  budget: number,
  refresh: number,
) => {
  const fromDataset: { row: T; score: { rating: number; votes: number } }[] = [];
  const rest: T[] = [];
  for (const row of rows) {
    const score = row.imdbId ? ratings?.get(row.imdbId) : undefined;
    if (score) {
      fromDataset.push({ row, score });
    } else {
      rest.push(row);
    }
  }
  return { fromDataset, ...planOmdbCalls(rest, budget, refresh) };
};

/**
 * Older years the cron works on, in order: those with no top, then those still holding a
 * pre-FIL-I32 top of ten, newest first within each.
 */
export const olderTopYears = (sizes: ReadonlyMap<number, number>, today: string) => {
  const missing: number[] = [];
  const legacy: number[] = [];
  for (let year = yearOf(today) - 2; year >= FIRST_TOP_YEAR; year -= 1) {
    const size = sizes.get(year) ?? 0;
    if (size === 0) {
      missing.push(year);
    } else if (size <= LEGACY_IMDB_TOP_SIZE) {
      legacy.push(year);
    }
  }
  return [...missing, ...legacy];
};

/** Cine opens on this year: until March, last year (this one has barely started). */
export const defaultTopYear = (today: string) => (monthOf(today) <= 3 ? yearOf(today) - 1 : yearOf(today));

/** Years the selector offers, newest first. */
export const topYearOptions = (today: string) => {
  const years: number[] = [];
  for (let year = yearOf(today); year >= FIRST_TOP_YEAR; year -= 1) {
    years.push(year);
  }
  return years;
};

export const parseTopYear = (value: unknown, today: string) => {
  const raw = Array.isArray(value) ? value.at(-1) : value;
  const year = Number(raw);
  return Number.isInteger(year) && year >= FIRST_TOP_YEAR && year <= yearOf(today) ? year : defaultTopYear(today);
};

export const yearTopSlug = (year: number) => `top-${year}`;
export const yearTopName = (year: number) => `Mi top de ${year}`;

/** «Tu top 10 de 2026», or «Tu top 6 de 2025» while it has fewer. */
export const yourTopLabel = (year: number, count: number) =>
  `Tu top ${count > 0 && count < YEAR_TOP_SIZE ? count : YEAR_TOP_SIZE} de ${year}`;

export type YearTopPick = { titleId: string; watched: boolean; year: number | null; kind: "MOVIE" | "SERIES" };

/** Server-side rules of a top: ≤ 10, no repeats, only movies of that release year you saw. */
export const yearTopError = (year: number, titleIds: readonly string[], picks: readonly YearTopPick[]) => {
  if (titleIds.length > YEAR_TOP_SIZE) {
    return `Tu top tiene ${YEAR_TOP_SIZE} lugares.`;
  }
  if (new Set(titleIds).size !== titleIds.length) {
    return "Una película solo puede estar una vez.";
  }
  const byId = new Map(picks.map((pick) => [pick.titleId, pick]));
  for (const titleId of titleIds) {
    const pick = byId.get(titleId);
    if (!pick) {
      return "Película no encontrada.";
    }
    if (pick.kind !== "MOVIE") {
      return "El top del año es de películas.";
    }
    if (pick.year !== year) {
      return `Solo entran películas estrenadas en ${year}.`;
    }
    if (!pick.watched) {
      return "Solo entran películas que ya viste.";
    }
  }
  return null;
};

const PLURAL = new Intl.PluralRules("es-MX");

/** «Has visto 1 película de 2024. Con 3 ya hay top.» / «Has visto 4 películas de 2024. Ordénalas a tu gusto.» */
export const watchedOfYearCopy = (year: number, count: number) => {
  const noun = PLURAL.select(count) === "one" ? "película" : "películas";
  const lead = `Has visto ${count} ${noun} de ${year}.`;
  return count < 2 ? `${lead} Con ${YEAR_TOP_MIN_PICKS} ya hay top.` : `${lead} Ordénalas a tu gusto.`;
};

/** The card's button before a top exists: «Empezar mi top» with one or two films, «Armar mi top» from three. */
export const startTopLabel = (count: number) => (count < YEAR_TOP_MIN_PICKS ? "Empezar mi top" : "Armar mi top");

/**
 * Older years are computed by the nightly cron, one a run, newest first (FIL-I23-1): the day
 * `year` gets its turn, counting the missing years ahead of it. Tomorrow when it is next.
 */
export const pendingTopDay = (year: number, yearsWithTop: readonly number[], today: string) => {
  let ahead = 0;
  for (let other = yearOf(today) - 2; other > year; other -= 1) {
    if (!yearsWithTop.includes(other)) {
      ahead += 1;
    }
  }
  return addDays(today, ahead + 1);
};

/** «mañana» or «el jue 22 oct». */
export const pendingTopDayLabel = (year: number, yearsWithTop: readonly number[], today: string) => {
  const day = pendingTopDay(year, yearsWithTop, today);
  if (day === addDays(today, 1)) {
    return "mañana";
  }
  return `el ${ticketStub(day).weekday.toLowerCase()} ${formatShortDay(day)}`;
};
