import type { TitleKind } from "@/db/schema";
import { TMDB_TV_TYPE, type TmdbDiscoverOptions } from "@/lib/tmdb-discover-params";

/**
 * Para ti's eight antojos (FIL-I60-2): what the person feels like. Each one is a set of TMDB
 * /discover queries per kind; their results, merged, are the antojo's shared pool. Ids shared
 * with Hoy's ánimo (`reir`, `pensar` in `tonight/budget.ts`) mean the same thing there; Hoy's
 * five moods do not change.
 *
 * Genre ids are TMDB's. Movies: Acción 28, Aventura 12, Animación 16, Comedia 35, Crimen 80,
 * Documental 99, Drama 18, Familia 10751, Historia 36, Terror 27, Misterio 9648, Romance 10749,
 * Ciencia ficción 878, Suspense 53, Bélica 10752. Series: Action & Adventure 10759,
 * Kids 10762, News 10763, Reality 10764, Sci-Fi & Fantasy 10765, Soap 10766, Talk 10767,
 * War & Politics 10768 (TV has no Terror or Romance genre: Miedo uses keywords there).
 * Keyword ids checked on themoviedb.org on 2026-11-17.
 */

export const ANTOJO_IDS = ["reir", "llorar", "miedo", "adrenalina", "pensar", "reciente", "corta", "joya"] as const;

export type AntojoId = (typeof ANTOJO_IDS)[number];

/** One discover call of a pool: everything but kind and page. */
export type AntojoQuery = Omit<TmdbDiscoverOptions, "kind" | "page">;

export type Antojo = {
  id: AntojoId;
  label: string;
  /** The discover queries of each kind; `now` sets the year window of «Algo reciente». */
  queries: (kind: TitleKind, now: Date) => readonly AntojoQuery[];
};

const KEYWORD = {
  tearjerker: 156924,
  tearJerker: 346048,
  sad: 276222,
  sadStory: 238263,
  sadRomance: 352267,
  horror: 315058,
  supernaturalHorror: 256183,
} as const;

/** Votes a title needs to enter a pool: below it TMDB's average says little. */
export const POOL_MIN_VOTES: Record<TitleKind, number> = { MOVIE: 150, SERIES: 60 };

/** Series pools keep to fiction: no reality, talk shows, news or video (scripted + miniseries). */
const SERIES_TYPES = [TMDB_TV_TYPE.scripted, TMDB_TV_TYPE.miniseries] as const;
/** Kids' and talk genres never belong to an adult antojo. */
const SERIES_NOT = [10762, 10763, 10764, 10767] as const;

const movie = (query: AntojoQuery): AntojoQuery => ({ voteCountGte: POOL_MIN_VOTES.MOVIE, ...query });
const series = (query: AntojoQuery): AntojoQuery => ({
  voteCountGte: POOL_MIN_VOTES.SERIES,
  tvTypes: SERIES_TYPES,
  ...query,
  withoutGenres: [...SERIES_NOT, ...(query.withoutGenres ?? [])],
});

const byKind =
  (movies: readonly AntojoQuery[], shows: readonly AntojoQuery[]) =>
  (kind: TitleKind): readonly AntojoQuery[] =>
    kind === "SERIES" ? shows.map(series) : movies.map(movie);

const yearOf = (now: Date) => Number(now.toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" }).slice(0, 4));

export const ANTOJOS: readonly Antojo[] = [
  {
    id: "reir",
    label: "Reír",
    queries: byKind(
      [{ withGenres: [35], withoutGenres: [27, 99] }],
      [{ withGenres: [35], withoutGenres: [99] }],
    ),
  },
  {
    id: "llorar",
    label: "Llorar",
    queries: byKind(
      [
        {
          withGenres: [18],
          withoutGenres: [16],
          withKeywords: [KEYWORD.tearjerker, KEYWORD.tearJerker, KEYWORD.sad, KEYWORD.sadStory, KEYWORD.sadRomance],
        },
        { withGenres: [18, 10749], withoutGenres: [16, 35], voteAverageGte: 7 },
      ],
      [
        { withGenres: [18], withoutGenres: [16], withKeywords: [KEYWORD.tearjerker, KEYWORD.tearJerker, KEYWORD.sad, KEYWORD.sadStory] },
        { withGenres: [18], withoutGenres: [16, 35, 80, 10759, 10765], voteAverageGte: 7.8 },
      ],
    ),
  },
  {
    id: "miedo",
    label: "Miedo",
    queries: byKind(
      [{ withGenres: [27] }],
      [{ withKeywords: [KEYWORD.horror, KEYWORD.supernaturalHorror], withoutGenres: [16, 35] }],
    ),
  },
  {
    id: "adrenalina",
    label: "Adrenalina",
    queries: byKind(
      [{ withAnyGenres: [28, 12, 53], withoutGenres: [16, 10751] }],
      [{ withGenres: [10759], withoutGenres: [16] }, { withGenres: [80, 18], voteAverageGte: 7.5 }],
    ),
  },
  {
    id: "pensar",
    label: "Pensar",
    // Hoy's Pensar (Documental, Historia, Ciencia ficción, Bélica) plus Misterio.
    queries: byKind(
      [{ withAnyGenres: [99, 36, 878, 10752, 9648], voteAverageGte: 6.8 }],
      [{ withAnyGenres: [99, 10765, 10768, 9648], voteAverageGte: 7.2 }],
    ),
  },
  {
    id: "reciente",
    label: "Algo reciente",
    queries: (kind, now) => {
      const year = yearOf(now);
      return byKind(
        [{ yearFrom: year - 2, yearTo: year, withoutGenres: [99] }],
        [{ yearFrom: year - 2, yearTo: year, withoutGenres: [99] }],
      )(kind);
    },
  },
  {
    id: "corta",
    label: "Corta",
    // Films of 100 min or less (60 up, so no shorts); series: miniseries.
    queries: byKind(
      [{ runtimeGte: 60, runtimeLte: 100, withoutGenres: [99] }],
      [{ tvTypes: [TMDB_TV_TYPE.miniseries], withoutGenres: [99] }],
    ),
  },
  {
    id: "joya",
    label: "Joya escondida",
    // High score, few votes: what the crowd missed.
    queries: byKind(
      [{ voteAverageGte: 7.3, voteCountGte: 200, voteCountLte: 5000, withoutGenres: [99, 16], sortBy: "vote_average.desc" }],
      [{ voteAverageGte: 7.6, voteCountGte: 80, voteCountLte: 1500, withoutGenres: [99, 16], sortBy: "vote_average.desc" }],
    ),
  },
];

export const isAntojoId = (value: unknown): value is AntojoId =>
  typeof value === "string" && (ANTOJO_IDS as readonly string[]).includes(value);

export const antojoById = (id: string | null | undefined): Antojo | null =>
  ANTOJOS.find((antojo) => antojo.id === id) ?? null;

export const POOL_KINDS: readonly TitleKind[] = ["MOVIE", "SERIES"];

/**
 * «Más como esto» from a recommended card in Hoy (FIL-I60-6): the antojo its genres point to, in
 * this order (the most telling genre wins), or null when none fits (then the opening screen).
 * Genre names as the catalog stores them: es-MX for movies, TMDB's English for TV-only ones.
 */
const GENRE_ANTOJO: ReadonlyArray<[AntojoId, readonly string[]]> = [
  ["miedo", ["terror"]],
  ["reir", ["comedia"]],
  ["adrenalina", ["accion", "aventura", "suspense", "action & adventure", "crimen"]],
  ["pensar", ["ciencia ficcion", "documental", "historia", "misterio", "belica", "sci-fi & fantasy", "war & politics"]],
  ["llorar", ["drama", "romance"]],
];

const fold = (value: string) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();

export const antojoForGenres = (names: readonly string[]): AntojoId | null => {
  const folded = new Set(names.map(fold));
  return GENRE_ANTOJO.find(([, genres]) => genres.some((genre) => folded.has(genre)))?.[0] ?? null;
};

/** Where «Más como esto» goes. */
export const moreLikeHref = (genreNames: readonly string[]) => {
  const antojo = antojoForGenres(genreNames);
  return antojo ? `/para-ti?antojo=${antojo}` : "/para-ti";
};
