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

/**
 * `wins` and `nominated` (the nominations that did not win, FIL-I45-1), each newest first;
 * `nominations` counts both.
 */
export type PersonOscars = { wins: PersonOscarRow[]; nominated: PersonOscarRow[]; nominations: number };

export type FoundMovie = { tmdbId: number; title: string | null; posterPath: string | null };

/**
 * `/find` runs for the 12 newest entries that name a film, wins and nominations together
 * (Spielberg, Disney…); older ones keep the dataset title.
 */
export const OSCAR_FIND_MAX = 12;

/** Rows shown before «Ver los N». */
export const OSCAR_ROWS_COLLAPSED = 4;

export const oscarRow = (win: OscarWin, found: FoundMovie | null, index: number, keyPrefix?: string): PersonOscarRow => ({
  key: `${keyPrefix ? `${keyPrefix}:` : ""}${win.ceremony}:${win.category}:${index}`,
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
  // The newest entries, wins and nominations together, are the ones that get a TMDB lookup.
  const ranked = [
    ...record.wins.map((entry, index) => ({ entry, won: true, index })),
    ...record.nominated.map((entry, index) => ({ entry, won: false, index })),
  ].sort((a, b) => b.entry.ceremony - a.entry.ceremony);
  const looked = new Set(
    ranked
      .filter(({ entry }) => entry.film?.imdbId)
      .slice(0, OSCAR_FIND_MAX)
      .map(({ won, index }) => `${won ? "w" : "x"}${index}`),
  );
  const resolve = (list: OscarWin[], prefix: "w" | "x") =>
    Promise.all(
      list.map(async (entry, index) => {
        const imdbId = entry.film?.imdbId;
        const found = imdbId && looked.has(`${prefix}${index}`) ? await lookup(imdbId) : null;
        return oscarRow(entry, found, index, prefix === "x" ? "nom" : undefined);
      }),
    );
  const [wins, nominated] = await Promise.all([resolve(record.wins, "w"), resolve(record.nominated, "x")]);
  return { wins, nominated, nominations: record.nominations };
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

/** One ticket on the person view's axis (FIL-I45-4): a win or a nomination that did not win. */
export type OscarTicket = { row: PersonOscarRow; won: boolean };

/** Wins and nominations together, newest first; at one ceremony the win goes first. */
export const oscarTickets = ({ wins, nominated }: PersonOscars): OscarTicket[] =>
  [...wins.map((row) => ({ row, won: true })), ...nominated.map((row) => ({ row, won: false }))].sort(
    (a, b) => b.row.year - a.row.year || Number(b.won) - Number(a.won),
  );

/** «2 Óscar · 16 nominaciones», «4 nominaciones · ninguno ganado», «1 Óscar». */
export const oscarsSummaryLine = ({ wins, nominations }: PersonOscars) => {
  const noms = `${nominations} ${nominationsWord(nominations)}`;
  if (wins.length === 0) {
    return `${noms} · ninguno ganado`;
  }
  return nominations > wins.length ? `${wins.length} Óscar · ${noms}` : `${wins.length} Óscar`;
};
