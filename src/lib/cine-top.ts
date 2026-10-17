/**
 * Lo mejor del año (FIL-I17-5), the pure half: the IMDb ranking with its vote floor, which
 * year Cine opens on, and the rules of «Tu top 10 de {año}».
 */

export const YEAR_TOP_SIZE = 10;
/** TMDB candidates per year (by vote count); OMDb is asked about each, ≤ 40 calls a year. */
export const YEAR_TOP_CANDIDATES = 40;
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

/** By IMDb rating, ties to the most voted; only films over the floor; ten at most. */
export const rankYearTop = (candidates: readonly YearTopCandidate[], floor: number): RankedYearTop[] =>
  candidates
    .flatMap((candidate) =>
      candidate.imdbRating != null && candidate.imdbVotes != null && candidate.imdbVotes >= floor
        ? [{ catalogId: candidate.catalogId, imdbRating: candidate.imdbRating, imdbVotes: candidate.imdbVotes }]
        : [],
    )
    .sort((a, b) => b.imdbRating - a.imdbRating || b.imdbVotes - a.imdbVotes)
    .filter((entry, index, all) => all.findIndex((other) => other.catalogId === entry.catalogId) === index)
    .slice(0, YEAR_TOP_SIZE)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));

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
