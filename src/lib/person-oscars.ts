/**
 * The «Óscar» panel of the person view (FIL-I43): rows, labels and the TMDB resolution, pure and
 * client-safe. The data comes from `@/lib/oscars` (server-only) through `loadPersonFilmography`.
 */
import type { OscarWin, PersonOscarRecord } from "@/lib/oscars-core";

export type PersonOscarRow = {
  key: string;
  year: number;
  categoryEs: string;
  /** Spanish title from TMDB, else the dataset's English one; null for a win without a film. */
  title: string | null;
  /** TMDB movie id when `/find` resolved it: the row links to its ficha. */
  tmdbId: number | null;
  posterPath: string | null;
};

export type PersonOscars = { wins: PersonOscarRow[]; nominations: number };

export type FoundMovie = { tmdbId: number; title: string | null; posterPath: string | null };

/** `/find` runs for the newest wins only (Spielberg, Disney…); older ones keep the dataset title. */
export const OSCAR_FIND_MAX = 12;

/** Rows shown before «Ver los N». */
export const OSCAR_ROWS_COLLAPSED = 4;

export const oscarRow = (win: OscarWin, found: FoundMovie | null, index: number): PersonOscarRow => ({
  key: `${win.ceremony}:${win.category}:${index}`,
  year: win.year,
  categoryEs: win.categoryEs,
  title: win.film ? found?.title || win.film.title : null,
  tmdbId: win.film ? (found?.tmdbId ?? null) : null,
  posterPath: win.film ? (found?.posterPath ?? null) : null,
});

/**
 * Wins with their Spanish title and poster: the 12 newest that name a film go through `find` in
 * parallel; one that fails falls back to the English title and no poster, never the whole panel.
 */
export const resolvePersonOscars = async (
  record: PersonOscarRecord | null,
  find: (imdbId: string) => Promise<FoundMovie | null>,
): Promise<PersonOscars | null> => {
  if (!record || record.nominations <= 0) {
    return null;
  }
  const cache = new Map<string, Promise<FoundMovie | null>>();
  const lookup = (imdbId: string) => {
    let pending = cache.get(imdbId);
    if (!pending) {
      pending = find(imdbId).catch(() => null);
      cache.set(imdbId, pending);
    }
    return pending;
  };
  const wins = await Promise.all(
    record.wins.map(async (win, index) => {
      const imdbId = win.film?.imdbId;
      const found = imdbId && index < OSCAR_FIND_MAX ? await lookup(imdbId) : null;
      return oscarRow(win, found, index);
    }),
  );
  return { wins, nominations: record.nominations };
};

const nominationsWord = (count: number) => (count === 1 ? "nominación" : "nominaciones");

/** «2 Óscar» + «16 nominaciones» (null when every nomination was a win). Invariant plural, as awardChipLabel. */
export const oscarsHeader = ({ wins, nominations }: PersonOscars) => ({
  wins: `${wins.length} Óscar`,
  nominations: nominations > wins.length ? `${nominations} ${nominationsWord(nominations)}` : null,
});

/** Nominations only: «8 nominaciones al Óscar». */
export const oscarNominationsLine = (nominations: number) =>
  `${nominations} ${nominationsWord(nominations)} al Óscar`;

/** The rows on screen and the «Ver los N» button (null when nothing is hidden). */
export const visibleOscarRows = (rows: PersonOscarRow[], expanded: boolean) => {
  const hidden = rows.length > OSCAR_ROWS_COLLAPSED && !expanded;
  return {
    rows: hidden ? rows.slice(0, OSCAR_ROWS_COLLAPSED) : rows,
    more: hidden ? `Ver los ${rows.length}` : null,
  };
};

/** Line 2: «2020 · Mejor fotografía»; a win without a film already names the award in line 1. */
export const oscarRowMeta = (row: PersonOscarRow) => (row.title ? `${row.year} · ${row.categoryEs}` : String(row.year));
