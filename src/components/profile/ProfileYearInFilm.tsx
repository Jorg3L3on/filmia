import { YearInFilmCard, MonthInFilmCard } from "@/components/profile/YearInFilmCards";
import { toDateInput, todayDateInput } from "@/lib/dates";
import { parseStoredTmdbGenres } from "@/lib/diary-picks";
import { loadWatchedBetween } from "@/lib/queries";
import { requireUserId } from "@/lib/session";
import { monthInFilm, previousMonth, yearInFilm, type FilmEntry } from "@/lib/year-in-film";

/**
 * Perfil «Tu año en cine» and «Tu mes en cine» (FIL-I46-5): read from the diary since January 1
 * (or the start of last month, in January), computed with the diary's own day rule.
 */
export const ProfileYearInFilm = async () => {
  const userId = await requireUserId();
  const today = todayDateInput();
  const year = Number(today.slice(0, 4));
  const lastMonth = previousMonth(today);
  const since = new Date(Date.UTC(Math.min(year, Number(lastMonth.slice(0, 4))), lastMonth.startsWith(`${year}-`) ? 0 : 11, 1));
  const rows = await loadWatchedBetween(userId, since);
  const entries: FilmEntry[] = rows.map((row) => ({
    id: row.id,
    name: row.name,
    posterPath: row.posterPath ?? null,
    watchedAt: row.watchedAt ? toDateInput(row.watchedAt) + "T12:00:00Z" : null,
    runtimeMinutes: row.runtimeMinutes ?? null,
    kind: row.kind === "SERIES" ? "SERIES" : "MOVIE",
    rating: row.rating ?? null,
    genres: parseStoredTmdbGenres(row.tmdbGenres).map((genre) => genre.name),
  }));
  const month = monthInFilm(entries, lastMonth);
  return (
    <div className="space-y-7">
      <YearInFilmCard stats={yearInFilm(entries, year)} />
      {month ? <MonthInFilmCard month={month} /> : null}
    </div>
  );
};
