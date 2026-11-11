import { toDateInput } from "@/lib/dates";

/**
 * «Tu año en cine» and «Tu mes en cine» on Perfil (FIL-I46-5). Pure. Days follow the diary's own
 * rule (FIL-I41): an entry's day is `toDateInput(watchedAt)`, the UTC calendar day it is stored on,
 * so month and week cuts match the diary exactly.
 */
export type FilmEntry = {
  id: string;
  name: string;
  posterPath: string | null;
  watchedAt: Date | string | null;
  runtimeMinutes: number | null;
  kind: "MOVIE" | "SERIES";
  rating: number | null;
  genres: string[];
};

export type YearInFilm = {
  year: number;
  entries: number;
  films: number;
  hours: number;
  longestWeekStreak: number;
  byMonth: number[];
  genres: Array<{ name: string; count: number }>;
};

/** Below this the year card invites instead of showing zeros. */
export const YEAR_MIN_ENTRIES = 3;

const dayOf = (entry: FilmEntry) => toDateInput(entry.watchedAt);

/** Monday-based week index of a `YYYY-MM-DD` day (days since 1970-01-05, a Monday, / 7). */
export const weekIndexOf = (day: string) => Math.floor((Date.parse(`${day}T00:00:00Z`) - Date.UTC(1970, 0, 5)) / (7 * 86_400_000));

export const longestWeekStreak = (days: readonly string[]) => {
  const weeks = [...new Set(days.filter(Boolean).map(weekIndexOf))].sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  for (let index = 0; index < weeks.length; index += 1) {
    run = index > 0 && weeks[index] === weeks[index - 1]! + 1 ? run + 1 : 1;
    best = Math.max(best, run);
  }
  return best;
};

export const yearInFilm = (entries: readonly FilmEntry[], year: number): YearInFilm => {
  const inYear = entries.filter((entry) => dayOf(entry).startsWith(`${year}-`));
  const byMonth = Array.from({ length: 12 }, () => 0);
  const genres = new Map<string, number>();
  let minutes = 0;
  for (const entry of inYear) {
    const month = Number(dayOf(entry).slice(5, 7));
    byMonth[month - 1] = (byMonth[month - 1] ?? 0) + 1;
    minutes += entry.runtimeMinutes && entry.runtimeMinutes > 0 ? entry.runtimeMinutes : 0;
    for (const genre of entry.genres) genres.set(genre, (genres.get(genre) ?? 0) + 1);
  }
  return {
    year,
    entries: inYear.length,
    films: inYear.filter((entry) => entry.kind === "MOVIE").length,
    hours: Math.round(minutes / 60),
    longestWeekStreak: longestWeekStreak(inYear.map(dayOf)),
    byMonth,
    genres: [...genres.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "es"))
      .slice(0, 5),
  };
};

export type MonthInFilm = {
  month: string;
  entries: FilmEntry[];
  hours: number;
  topGenre: string | null;
  best: FilmEntry | null;
};

/** `YYYY-MM` of the month before `today` (a `YYYY-MM-DD`). */
export const previousMonth = (today: string) => {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  return month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, "0")}`;
};

/** «Tu mes en cine»: null when the month has no entries (the card does not appear). Oldest first. */
export const monthInFilm = (entries: readonly FilmEntry[], month: string): MonthInFilm | null => {
  const inMonth = entries
    .filter((entry) => dayOf(entry).startsWith(`${month}-`))
    .sort((a, b) => dayOf(a).localeCompare(dayOf(b)) || a.name.localeCompare(b.name, "es"));
  if (inMonth.length === 0) return null;
  const year = yearInFilm(inMonth, Number(month.slice(0, 4)));
  const rated = inMonth.filter((entry) => entry.rating != null);
  const best = rated.length ? rated.reduce((top, entry) => ((entry.rating ?? 0) > (top.rating ?? 0) ? entry : top)) : null;
  return { month, entries: inMonth, hours: year.hours, topGenre: year.genres[0]?.name ?? null, best };
};

/**
 * Diario «Tira» (FIL-I46-5): the month's entries in the calendar's order — days ascending, and
 * within a day the order the calendar shows them in (`groupTitlesByWatchedDay` keeps it).
 */
export const stripOrder = <T extends { watchedAt: Date | string | null | undefined }>(titles: T[]) => {
  const byDay = new Map<string, T[]>();
  for (const title of titles) {
    const day = toDateInput(title.watchedAt);
    if (!day) continue;
    byDay.set(day, [...(byDay.get(day) ?? []), title]);
  }
  return [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0])).flatMap(([, items]) => items);
};
