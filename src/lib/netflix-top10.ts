import type { TitleKind } from "@/db";

/**
 * Netflix's published weekly Top 10 per country (FIL-I47-2), used credited as «Top 10 oficial»
 * (Jorge, 2026-11-10). The file has no ids: titles are English and matched to TMDB by name.
 * Pure rules here; the download and the writes live in `netflix-top10-store`.
 */

export const NETFLIX_TOP10_URL = "https://www.netflix.com/tudum/top10/data/all-weeks-countries.tsv";

/** Below this many matched titles a kind keeps the popularity list and its label. */
export const MIN_OFFICIAL_MATCHES = 6;

/** Whether a kind's matched rows may replace the popularity list (and its label). */
export const isOfficialListUsable = (matched: number) => matched >= MIN_OFFICIAL_MATCHES;

export type Top10Row = {
  /** Week end (Sunday), YYYY-MM-DD, as the file gives it. */
  week: string;
  kind: TitleKind;
  rank: number;
  showTitle: string;
  seasonTitle: string | null;
  weeks: number;
};

const COLUMNS = [
  "country_name",
  "country_iso2",
  "week",
  "category",
  "weekly_rank",
  "show_title",
  "season_title",
  "cumulative_weeks_in_top_10",
] as const;

/** Column positions from the header line; null when a column is missing (the file changed). */
export const parseTop10Header = (line: string): Record<(typeof COLUMNS)[number], number> | null => {
  const cells = line.trim().split("\t");
  const index = {} as Record<(typeof COLUMNS)[number], number>;
  for (const column of COLUMNS) {
    const at = cells.indexOf(column);
    if (at < 0) return null;
    index[column] = at;
  }
  return index;
};

/** One data line → a row for `country`, or null (other country, malformed, unknown category). */
export const parseTop10Line = (
  line: string,
  header: Record<(typeof COLUMNS)[number], number>,
  country = "MX",
): Top10Row | null => {
  const cells = line.split("\t");
  if (cells[header.country_iso2] !== country) return null;
  const category = cells[header.category];
  const kind: TitleKind | null = category === "Films" ? "MOVIE" : category === "TV" ? "SERIES" : null;
  const rank = Number(cells[header.weekly_rank]);
  const week = cells[header.week] ?? "";
  const showTitle = (cells[header.show_title] ?? "").trim();
  if (!kind || !Number.isInteger(rank) || rank < 1 || !/^\d{4}-\d{2}-\d{2}$/.test(week) || !showTitle) return null;
  const season = (cells[header.season_title] ?? "").trim();
  const weeks = Number(cells[header.cumulative_weeks_in_top_10]);
  return {
    week,
    kind,
    rank,
    showTitle,
    seasonTitle: season && season !== "N/A" ? season : null,
    weeks: Number.isInteger(weeks) && weeks > 0 ? weeks : 1,
  };
};

/**
 * Streams the file's lines and keeps only `country`'s rows of the latest week: the whole file
 * (~33 MB) is never held in memory.
 */
export const collectLatestWeek = async (lines: AsyncIterable<string>, country = "MX"): Promise<Top10Row[]> => {
  let header: ReturnType<typeof parseTop10Header> = null;
  let latest = "";
  let rows: Top10Row[] = [];
  for await (const line of lines) {
    if (!header) {
      header = parseTop10Header(line);
      if (!header) return [];
      continue;
    }
    const row = parseTop10Line(line, header, country);
    if (!row) continue;
    if (row.week > latest) {
      latest = row.week;
      rows = [];
    }
    if (row.week === latest) rows.push(row);
  }
  return rows.sort((a, b) => (a.kind === b.kind ? a.rank - b.rank : a.kind === "MOVIE" ? -1 : 1));
};

/** Splits a byte stream into lines. */
export async function* streamLines(stream: AsyncIterable<Uint8Array>): AsyncGenerator<string> {
  const decoder = new TextDecoder();
  let rest = "";
  for await (const chunk of stream) {
    rest += decoder.decode(chunk, { stream: true });
    let at = rest.indexOf("\n");
    while (at >= 0) {
      yield rest.slice(0, at).replace(/\r$/, "");
      rest = rest.slice(at + 1);
      at = rest.indexOf("\n");
    }
  }
  rest += decoder.decode();
  if (rest) yield rest;
}

/** Several seasons of one show share its best rank: one entry per show, Netflix's rank kept. */
export const dedupeShows = (rows: readonly Top10Row[]): Top10Row[] => {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = `${row.kind}:${normalizeTitle(row.showTitle)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const normalizeTitle = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(the|a|an)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export type MatchCandidate = { tmdbId: number; enName: string; originalName: string | null; popularity: number };

/**
 * TMDB hits whose English or original name equals the Netflix title (normalized), most popular
 * first. The store then keeps the first one that streams on Netflix MX. Nothing fuzzy: a wrong
 * film in an official list is worse than a skipped row.
 */
export const matchCandidates = <T extends MatchCandidate>(showTitle: string, hits: readonly T[]): T[] => {
  const wanted = normalizeTitle(showTitle);
  if (!wanted) return [];
  return hits
    .filter((hit) => normalizeTitle(hit.enName) === wanted || (hit.originalName && normalizeTitle(hit.originalName) === wanted))
    .sort((a, b) => b.popularity - a.popularity);
};

const DAY_MS = 24 * 60 * 60 * 1000;

const shiftDay = (day: string, days: number) => new Date(Date.parse(`${day}T12:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);

/** Week start (Monday) for a file week (its Sunday). */
export const weekStartOf = (weekEnd: string) => shiftDay(weekEnd, -6);

/**
 * The newest week Netflix should have published by `today` (MX day): the list for the week that
 * ended on Sunday appears on Tuesday. The cron downloads the file only when the stored week is older.
 */
export const expectedLatestWeekEnd = (today: string) => {
  const date = new Date(`${today}T12:00:00Z`);
  const sinceSunday = date.getUTCDay(); // 0 = Sunday
  const lastSunday = shiftDay(today, -sinceSunday);
  // Sunday and Monday: last week's file is not out yet.
  return sinceSunday < 2 ? shiftDay(lastSunday, -7) : lastSunday;
};

const MONTH = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** «semana del 2 al 8 de noviembre» (or «del 27 de octubre al 2 de noviembre») from the week start. */
export const officialWeekLabel = (weekStart: string) => {
  const end = shiftDay(weekStart, 6);
  const [, startMonth, startDay] = weekStart.split("-").map(Number);
  const [, endMonth, endDay] = end.split("-").map(Number);
  return startMonth === endMonth
    ? `semana del ${startDay} al ${endDay} de ${MONTH[endMonth - 1]}`
    : `semana del ${startDay} de ${MONTH[startMonth - 1]} al ${endDay} de ${MONTH[endMonth - 1]}`;
};

/** The day the next list appears (Tuesday after the next Sunday), for the closing card. */
export const nextOfficialDay = (today: string) => {
  const date = new Date(`${today}T12:00:00Z`);
  const toTuesday = (2 - date.getUTCDay() + 7) % 7 || 7;
  return shiftDay(today, toTuesday);
};
