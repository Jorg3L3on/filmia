import { and, asc, desc, eq, gte, lte, max, ne, or, sql } from "drizzle-orm";
import { cache } from "react";
import { catalog, cinemaReleases, db, type Platform } from "@/db";
import {
  addDays,
  HOME_AFTER_DAYS,
  HOME_LOOKBACK_DAYS,
  mxToday,
  upcomingHorizon,
  type CinemaReleaseStatus,
} from "@/lib/cine-core";
import { matchWatchProviderPlatform } from "@/lib/streaming-platforms";
import { parseStoredWatchProviders } from "@/lib/watch-providers";

/** Cine reads (FIL-I17-4): only the database. TMDB and OMDb are the cron's business. */

export type CineFilm = {
  catalogId: string;
  tmdbId: number;
  name: string;
  originalName: string | null;
  year: number | null;
  posterPath: string | null;
  mxReleaseDate: string;
  status: CinemaReleaseStatus;
  /** TMDB popularity at the last cron run: «Populares» in the cartelera sorts by it. */
  popularity: number;
  /** Platforms (ours) the film streams flatrate on in MX, in TMDB's order. */
  streaming: Platform[];
};

const filmColumns = {
  catalogId: cinemaReleases.catalogId,
  tmdbId: catalog.tmdbId,
  name: catalog.name,
  originalName: catalog.originalName,
  year: catalog.year,
  posterPath: catalog.posterPath,
  mxReleaseDate: cinemaReleases.mxReleaseDate,
  status: cinemaReleases.status,
  popularity: cinemaReleases.popularity,
  watchProvidersMx: catalog.watchProvidersMx,
};

export const streamingPlatformsOf = (watchProvidersMx: unknown): Platform[] => {
  const offers = parseStoredWatchProviders(watchProvidersMx)?.flatrate ?? [];
  return [...new Set(offers.flatMap((offer) => matchWatchProviderPlatform(offer) ?? []))];
};

const selectFilms = () => db.select(filmColumns).from(cinemaReleases).innerJoin(catalog, eq(catalog.id, cinemaReleases.catalogId));

type FilmRow = Awaited<ReturnType<typeof selectFilms>>[number];

const toFilm = (row: FilmRow): CineFilm => ({
  catalogId: row.catalogId,
  tmdbId: row.tmdbId,
  name: row.name,
  originalName: row.originalName,
  year: row.year,
  posterPath: row.posterPath,
  mxReleaseDate: row.mxReleaseDate,
  status: row.status === "now" || row.status === "upcoming" ? row.status : "gone",
  popularity: row.popularity,
  streaming: streamingPlatformsOf(row.watchProvidersMx),
});

/** In theaters now, newest premiere first. Films already streaming in MX stay: they are still showing. */
export const getNowShowing = cache(async (limit?: number) => {
  const query = selectFilms()
    .where(eq(cinemaReleases.status, "now"))
    .orderBy(desc(cinemaReleases.mxReleaseDate), desc(cinemaReleases.popularity));
  const rows = await (limit ? query.limit(limit) : query);
  return rows.map(toFilm);
});

/** Announced for MX theaters from tomorrow to `until` (default Dec 31), soonest first. */
export const getUpcoming = cache(async (until?: string) => {
  const today = mxToday();
  const rows = await selectFilms()
    .where(
      and(
        eq(cinemaReleases.status, "upcoming"),
        lte(cinemaReleases.mxReleaseDate, until ?? upcomingHorizon(today)),
      ),
    )
    .orderBy(asc(cinemaReleases.mxReleaseDate), desc(cinemaReleases.popularity));
  return rows.map(toFilm);
});

/**
 * «Ya en casa»: films that were in theaters in the last six months, left (or premiered more than
 * six weeks ago) and stream flatrate in MX today. The user's platforms come first.
 */
export const getHomeArrivals = cache(async (userPlatforms: readonly Platform[], limit = 24) => {
  const today = mxToday();
  const rows = await selectFilms()
    .where(
      and(
        gte(cinemaReleases.mxReleaseDate, addDays(today, -HOME_LOOKBACK_DAYS)),
        or(eq(cinemaReleases.status, "gone"), lte(cinemaReleases.mxReleaseDate, addDays(today, -HOME_AFTER_DAYS))),
        ne(cinemaReleases.status, "upcoming"),
        sql`jsonb_array_length(coalesce(${catalog.watchProvidersMx} -> 'flatrate', '[]'::jsonb)) > 0`,
      ),
    )
    .orderBy(desc(cinemaReleases.mxReleaseDate));
  const films = rows.map(toFilm).filter((film) => film.streaming.length > 0);
  return sortHomeArrivals(films, userPlatforms).slice(0, limit);
});

export type HomeArrival = CineFilm & { onMine: boolean };

/** Yours first (stable by release date), the rest after, flagged so the page can dim them. */
export const sortHomeArrivals = (films: readonly CineFilm[], userPlatforms: readonly Platform[]): HomeArrival[] => {
  const mine = new Set(userPlatforms);
  const flagged = films.map((film) => ({ ...film, onMine: film.streaming.some((platform) => mine.has(platform)) }));
  return [...flagged.filter((film) => film.onMine), ...flagged.filter((film) => !film.onMine)];
};

/** Newest cron touch: drives «Actualizado hace … h» when a run was missed. */
export const getCineLastRunAt = cache(async () => {
  const [row] = await db.select({ at: max(cinemaReleases.lastSeenAt) }).from(cinemaReleases);
  return row?.at ?? null;
});

/** The ficha badge: the film's MX theatrical status, when Cine knows it. */
export const getCinemaRelease = cache(async (catalogId: string) => {
  const row = await db.query.cinemaReleases.findFirst({
    where: eq(cinemaReleases.catalogId, catalogId),
    columns: { mxReleaseDate: true, status: true },
  });
  if (!row || (row.status !== "now" && row.status !== "upcoming")) {
    return null;
  }
  return { mxReleaseDate: row.mxReleaseDate, status: row.status as "now" | "upcoming" };
});
