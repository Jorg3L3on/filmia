/**
 * Quiniela del Óscar (FIL-I51-2): the season, the categories ready to draw, and one person's votes.
 * Nominees without a poster or a Mexican title in the file (built without TMDB, or written by hand)
 * are looked up by IMDb id with the app's 24 h TMDB cache; when TMDB fails they keep the Academy's
 * English title and no poster.
 */
import { getOscarCeremony } from "@/lib/quinielas/ceremonies";
import type { OscarCeremonyFile } from "@/lib/quinielas/ceremony-core";
import { getOscarSeason, getOscarVotes, type OscarSeason } from "@/lib/quinielas/store";
import { toBallotCategories, type BallotCategory } from "@/lib/quinielas/view";
import { findTmdbMovieByImdbId, isTmdbConfigured } from "@/lib/tmdb";

const withTmdb = async (file: OscarCeremonyFile): Promise<OscarCeremonyFile> => {
  if (!isTmdbConfigured()) {
    return file;
  }
  const missing = new Set<string>();
  for (const category of file.categories) {
    for (const nominee of category.nominees) {
      if (nominee.film.imdbId && (nominee.film.posterPath === undefined || nominee.film.titleEs === undefined)) {
        missing.add(nominee.film.imdbId);
      }
    }
  }
  if (missing.size === 0) {
    return file;
  }
  const found = new Map(
    await Promise.all(
      [...missing].map(async (imdbId) => [imdbId, await findTmdbMovieByImdbId(imdbId).catch(() => null)] as const),
    ),
  );
  return {
    ...file,
    categories: file.categories.map((category) => ({
      ...category,
      nominees: category.nominees.map((nominee) => {
        const movie = nominee.film.imdbId ? found.get(nominee.film.imdbId) : null;
        return movie
          ? {
              ...nominee,
              film: {
                ...nominee.film,
                tmdbId: nominee.film.tmdbId ?? movie.tmdbId,
                titleEs: nominee.film.titleEs ?? movie.title,
                posterPath: nominee.film.posterPath ?? movie.posterPath,
              },
            }
          : nominee;
      }),
    })),
  };
};

/** The ceremony's categories ready to draw, or null when the year has no file. */
export const loadOscarCategories = async (year: number): Promise<BallotCategory[] | null> => {
  const file = getOscarCeremony(year);
  return file ? toBallotCategories(await withTmdb(file)) : null;
};

export type OscarBallotData = {
  season: OscarSeason;
  categories: BallotCategory[];
  votes: Record<string, string>;
};

export const loadOscarBallot = async (userId: string, year: number, now = new Date()): Promise<OscarBallotData> => {
  const season = await getOscarSeason(year, now);
  if (season.phase === "pronto") {
    return { season, categories: [], votes: {} };
  }
  const [categories, votes] = await Promise.all([loadOscarCategories(year), getOscarVotes(userId, year)]);
  return { season, categories: categories ?? [], votes };
};
