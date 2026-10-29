import { and, eq, isNotNull, notInArray } from "drizzle-orm";
import { catalog, db, listItems, lists, titles, users, type CatalogRow, type Platform } from "@/db";
import { parseStoredTmdbGenres } from "@/lib/diary-picks";
import { PLATFORM_SERVICE_LABEL } from "@/lib/labels";
import { FAVORITAS_SLUG } from "@/lib/lists";
import { parseThreadPeople, rankSeeds, todayIso, type SeedCandidate, type ThreadPerson } from "@/lib/people/core";
import { currentAvailabilityPlatform, parseStoredStreamingPlatforms } from "@/lib/streaming-platforms";
import { parseStoredWatchProviders } from "@/lib/watch-providers";

/**
 * The library as Universo and «¿Las viste?» read it: the watched films with their people, the
 * seeds (best first) and the account's platforms.
 */

export type SeedTitle = SeedCandidate & {
  people: ThreadPerson[];
  genreIds: number[];
  posterPath: string | null;
};

export type LibraryContext = {
  seeds: SeedTitle[];
  /** TMDB ids of the movies the person has seen: «lo visto cuenta». */
  seenTmdbIds: Set<number>;
  platforms: Platform[];
  today: string;
};

export const loadLibraryContext = async (userId: string, now = new Date()): Promise<LibraryContext> => {
  const [rows, favoritas, user] = await Promise.all([
    db
      .select({ title: titles, film: catalog })
      .from(titles)
      .innerJoin(catalog, eq(titles.catalogId, catalog.id))
      .where(eq(titles.userId, userId)),
    db
      .select({ catalogId: listItems.catalogId })
      .from(listItems)
      .innerJoin(lists, eq(listItems.listId, lists.id))
      .where(and(eq(lists.userId, userId), eq(lists.slug, FAVORITAS_SLUG))),
    db.query.users.findFirst({ where: eq(users.id, userId), columns: { streamingPlatforms: true } }),
  ]);
  const favorite = new Set(favoritas.map((row) => row.catalogId));
  const all: SeedTitle[] = rows.map(({ title, film }) => ({
    catalogId: film.id,
    tmdbId: film.tmdbId,
    kind: film.kind,
    name: film.name,
    watched: title.watchedAt != null,
    // ¿Las viste? «me gustó» counts as a seed like stars do (FIL-I26).
    rating: title.rating ?? title.impliedRating,
    favorite: favorite.has(film.id),
    createdAt: title.createdAt,
    people: parseThreadPeople(film.tmdbPeople),
    genreIds: parseStoredTmdbGenres(film.tmdbGenres).map((genre) => genre.id),
    posterPath: film.posterPath,
  }));
  return {
    seeds: rankSeeds(all),
    seenTmdbIds: new Set(all.filter((title) => title.watched && title.kind === "MOVIE").map((title) => title.tmdbId)),
    platforms: parseStoredStreamingPlatforms(user?.streamingPlatforms),
    today: todayIso(now),
  };
};

/** Watched films of the person (catalog rows), for Universo and «¿Las viste?». */
export const loadWatchedFilms = async (userId: string, excludeCatalogIds: readonly string[] = []) => {
  const rows = await db
    .select({ title: titles, film: catalog })
    .from(titles)
    .innerJoin(catalog, eq(titles.catalogId, catalog.id))
    .where(
      and(
        eq(titles.userId, userId),
        isNotNull(titles.watchedAt),
        eq(catalog.kind, "MOVIE"),
        ...(excludeCatalogIds.length ? [notInArray(catalog.id, [...excludeCatalogIds])] : []),
      ),
    );
  return rows;
};

/** «HBO Max»: where the film streams, on one of your platforms when it can be. */
export const platformLabelOf = (film: CatalogRow, userPlatforms: readonly Platform[]) => {
  const platform = currentAvailabilityPlatform(parseStoredWatchProviders(film.watchProvidersMx), null, userPlatforms);
  return platform ? PLATFORM_SERVICE_LABEL[platform] : null;
};
