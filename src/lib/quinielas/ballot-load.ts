/**
 * Quinielas de premios (FIL-I51-2): a ceremony's season, its categories ready to draw, and one
 * person's votes. Nominees without a poster or a Mexican title in the file (written by hand, or
 * built without TMDB) are looked up by IMDb id, films and series alike, with the app's 24 h TMDB
 * cache; when TMDB fails they keep the awards' title and no poster.
 */
import { getCeremony } from "@/lib/quinielas/ceremonies";
import type { QuinielaCeremonyFile } from "@/lib/quinielas/ceremony-core";
import { getSeason, getVotes, type QuinielaSeason } from "@/lib/quinielas/store";
import { toBallotCategories, type BallotCategory } from "@/lib/quinielas/view";
import { findTmdbWorkByImdbId, isTmdbConfigured } from "@/lib/tmdb";

const withTmdb = async (file: QuinielaCeremonyFile): Promise<QuinielaCeremonyFile> => {
  if (!isTmdbConfigured()) {
    return file;
  }
  const missing = new Map<string, "movie" | "tv">();
  for (const category of file.categories) {
    for (const nominee of category.nominees) {
      if (nominee.work.imdbId && (nominee.work.posterPath === undefined || nominee.work.titleEs === undefined)) {
        missing.set(nominee.work.imdbId, nominee.work.kind);
      }
    }
  }
  if (missing.size === 0) {
    return file;
  }
  const found = new Map(
    await Promise.all(
      [...missing].map(
        async ([imdbId, kind]) => [imdbId, await findTmdbWorkByImdbId(imdbId, kind).catch(() => null)] as const,
      ),
    ),
  );
  return {
    ...file,
    categories: file.categories.map((category) => ({
      ...category,
      nominees: category.nominees.map((nominee) => {
        const work = nominee.work.imdbId ? found.get(nominee.work.imdbId) : null;
        return work
          ? {
              ...nominee,
              work: {
                ...nominee.work,
                tmdbId: nominee.work.tmdbId ?? work.tmdbId,
                titleEs: nominee.work.titleEs ?? work.title,
                posterPath: nominee.work.posterPath ?? work.posterPath,
              },
            }
          : nominee;
      }),
    })),
  };
};

/** The ceremony's categories ready to draw, or null when there is no such ceremony. */
export const loadCategories = async (ceremonyId: string): Promise<BallotCategory[] | null> => {
  const file = getCeremony(ceremonyId);
  return file ? toBallotCategories(await withTmdb(file)) : null;
};

export type BallotData = {
  season: QuinielaSeason;
  categories: BallotCategory[];
  votes: Record<string, string>;
};

export const loadBallot = async (userId: string, ceremonyId: string, now = new Date()): Promise<BallotData> => {
  const season = await getSeason(ceremonyId, now);
  if (season.phase === "pronto") {
    return { season, categories: [], votes: {} };
  }
  const [categories, votes] = await Promise.all([loadCategories(ceremonyId), getVotes(userId, ceremonyId)]);
  return { season, categories: categories ?? [], votes };
};
