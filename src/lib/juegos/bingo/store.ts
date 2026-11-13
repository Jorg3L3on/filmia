import { and, desc, eq, gte, inArray, isNotNull, lt, sql } from "drizzle-orm";
import { catalog, cinemaReleases, db, titles, users } from "@/db";
import { addDays, mxToday } from "@/lib/cine-core";
import { mxDayStart } from "@/lib/juegos/core";
import { bingoCardOf, tallyBingo, type BingoFilm, type BingoSquareDef, type BingoTally } from "@/lib/juegos/bingo/core";
import { monthBounds } from "@/lib/juegos/estrenos/core";
import { initialOf, retoNames } from "@/lib/juegos/retos/core";

/**
 * Bingo del mes on the database (FIL-I55-2): computed on read from the diary. Only SELECTs here:
 * opening the bingo never writes a row, least of all to `Title`.
 */

type FilmRow = BingoFilm & { userId: string; name: string; posterPath: string | null; watchedAt: Date };

const genreNames = (value: unknown) =>
  Array.isArray(value) ? value.flatMap((genre) => (genre && typeof (genre as { name?: unknown }).name === "string" ? [(genre as { name: string }).name] : [])) : [];

/**
 * Films logged with a date inside a month, `[from, to]` (Mexico City days), for some accounts or
 * all. An undated «vista alguna vez» (`watchedUndated`) never counts.
 */
export const loadDatedFilms = async (input: { from: string; to: string; userIds?: string[] }): Promise<FilmRow[]> => {
  const conditions = [
    isNotNull(titles.watchedAt),
    eq(titles.watchedUndated, false),
    gte(titles.watchedAt, mxDayStart(input.from)),
    lt(titles.watchedAt, mxDayStart(addDays(input.to, 1))),
  ];
  if (input.userIds) {
    if (input.userIds.length === 0) return [];
    conditions.push(inArray(titles.userId, input.userIds));
  }
  const rows = await db
    .select({
      userId: titles.userId,
      watchedAt: titles.watchedAt,
      catalogId: catalog.id,
      kind: catalog.kind,
      name: catalog.name,
      posterPath: catalog.posterPath,
      year: catalog.year,
      runtimeMinutes: catalog.runtimeMinutes,
      originalLanguage: catalog.originalLanguage,
      tmdbGenres: catalog.tmdbGenres,
      awards: catalog.awards,
      mxReleaseDate: cinemaReleases.mxReleaseDate,
    })
    .from(titles)
    .innerJoin(catalog, eq(catalog.id, titles.catalogId))
    .leftJoin(cinemaReleases, eq(cinemaReleases.catalogId, catalog.id))
    .where(and(...conditions))
    .orderBy(titles.watchedAt, titles.id);
  return rows.map((row) => ({
    userId: row.userId,
    catalogId: row.catalogId,
    kind: row.kind,
    name: row.name,
    posterPath: row.posterPath,
    year: row.year,
    runtimeMinutes: row.runtimeMinutes,
    originalLanguage: row.originalLanguage,
    genres: genreNames(row.tmdbGenres),
    awards: row.awards,
    mxReleaseDate: row.mxReleaseDate,
    watchedAt: row.watchedAt!,
    watchedDay: mxToday(row.watchedAt!),
  }));
};

const groupByUser = <T extends { userId: string }>(rows: readonly T[]) => {
  const out = new Map<string, T[]>();
  for (const row of rows) out.set(row.userId, [...(out.get(row.userId) ?? []), row]);
  return out;
};

export type BingoSquareView = {
  index: number;
  id: string;
  label: string;
  ticked: boolean;
  film: { name: string; posterPath: string | null } | null;
};

export type BingoTableRow = { userId: string; name: string; initial: string; squares: number; lines: number; me: boolean; place: number };

export type BingoView = {
  month: string;
  squares: BingoSquareView[];
  mine: BingoTally;
  table: BingoTableRow[];
};

/** Most lines first, then most squares; ties share the place. Only accounts with a ticked square. */
export const rankBingo = <T extends { squares: number; lines: number; name: string }>(rows: readonly T[]) => {
  const sorted = rows.filter((row) => row.squares > 0).sort((a, b) => b.lines - a.lines || b.squares - a.squares || a.name.localeCompare(b.name, "es"));
  let place = 0;
  return sorted.map((row, index) => {
    const previous = sorted[index - 1];
    if (!previous || previous.lines !== row.lines || previous.squares !== row.squares) place = index + 1;
    return { ...row, place };
  });
};

/** One person's card for a month plus the table of everyone who ticked at least one square. */
export const loadBingo = async (userId: string, now = new Date()): Promise<BingoView> => {
  const today = mxToday(now);
  const month = today.slice(0, 7);
  const card = bingoCardOf(month);
  const { from, to } = monthBounds(month);
  const films = await loadDatedFilms({ from, to });
  const byUser = groupByUser(films);
  const people = byUser.size
    ? await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, [...byUser.keys()]))
    : [];
  const names = retoNames(people);

  const tallies = new Map([...byUser.entries()].map(([id, rows]) => [id, tallyBingo(card, rows)]));
  const myFilms = byUser.get(userId) ?? [];
  const mine = tallies.get(userId) ?? tallyBingo(card, []);
  const table = rankBingo(
    [...tallies.entries()].map(([id, tally]) => {
      const name = id === userId ? "Tú" : (names.get(id) ?? "Alguien");
      return { userId: id, name, initial: id === userId ? "T" : initialOf(name), squares: tally.squares, lines: tally.lines, me: id === userId };
    }),
  );
  return {
    month,
    squares: card.map((square, index) => {
      const film = mine.assignment[index] == null ? null : myFilms[mine.assignment[index]!]!;
      return { index, id: square.id, label: square.label, ticked: film != null, film: film ? { name: film.name, posterPath: film.posterPath } : null };
    }),
    mine,
    table,
  };
};

export type BingoSuggestion = { catalogId: string; name: string; year: number | null; posterPath: string | null; kind: "MOVIE" | "SERIES"; tmdbId: number };

const SUGGESTION_POOL = 600;

/**
 * «Qué ver para esta casilla»: well-known films of `Catalog` that fit the square and the person has
 * not logged yet. Only reads.
 */
export const suggestForSquare = async (userId: string, square: BingoSquareDef, now = new Date(), limit = 6): Promise<BingoSuggestion[]> => {
  const today = mxToday(now);
  const seen = new Set(
    (await db.select({ catalogId: titles.catalogId }).from(titles).where(and(eq(titles.userId, userId), isNotNull(titles.watchedAt)))).map(
      (row) => row.catalogId,
    ),
  );
  const pool = await db
    .select({
      catalogId: catalog.id,
      tmdbId: catalog.tmdbId,
      kind: catalog.kind,
      name: catalog.name,
      posterPath: catalog.posterPath,
      year: catalog.year,
      runtimeMinutes: catalog.runtimeMinutes,
      originalLanguage: catalog.originalLanguage,
      tmdbGenres: catalog.tmdbGenres,
      awards: catalog.awards,
      mxReleaseDate: cinemaReleases.mxReleaseDate,
    })
    .from(catalog)
    .leftJoin(cinemaReleases, eq(cinemaReleases.catalogId, catalog.id))
    .where(and(eq(catalog.kind, "MOVIE"), square.id === "cine" ? eq(cinemaReleases.status, "now") : sql`true`))
    .orderBy(desc(sql`coalesce(${catalog.imdbVotes}, 0)`), catalog.id)
    .limit(SUGGESTION_POOL);
  return pool
    .filter((row) => !seen.has(row.catalogId))
    .filter((row) =>
      square.test({
        catalogId: row.catalogId,
        kind: row.kind,
        year: row.year,
        runtimeMinutes: row.runtimeMinutes,
        originalLanguage: row.originalLanguage,
        genres: genreNames(row.tmdbGenres),
        awards: row.awards,
        mxReleaseDate: row.mxReleaseDate,
        // A suggestion is about watching it today.
        watchedDay: today,
      }),
    )
    .slice(0, limit)
    .map((row) => ({ catalogId: row.catalogId, name: row.name, year: row.year, posterPath: row.posterPath, kind: row.kind, tmdbId: row.tmdbId }));
};
