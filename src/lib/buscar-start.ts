import { and, eq, gte, inArray, or, sql } from "drizzle-orm";
import { cache } from "react";
import { catalog, db, listItems, lists, titles } from "@/db";
import { LOVED_RATING, rankFavoriteDirectors, type FavoriteDirector } from "@/lib/favorite-directors";
import { FAVORITAS_SLUG } from "@/lib/lists";
import { loadUserPlatformArrivals } from "@/lib/platform-arrivals-store";
import { getTmdbPersonProfilePath } from "@/lib/tmdb";
import { parseStoredPeople } from "@/lib/tonight-store";
import type { Platform } from "@/db";

export type StartDirector = FavoriteDirector & { profilePath: string | null };

const START_DIRECTORS = 6;

/**
 * Buscar's start screen: directors of your Favoritas and 4★+ titles, with their TMDB photo
 * when there is one. A failed photo lookup never hides the director.
 */
export const getFavoriteDirectors = cache(async (userId: string): Promise<StartDirector[]> => {
  const favoritas = db
    .select({ catalogId: listItems.catalogId })
    .from(listItems)
    .innerJoin(lists, eq(lists.id, listItems.listId))
    .where(and(eq(lists.userId, userId), eq(lists.slug, FAVORITAS_SLUG)));

  const [favoriteRows, rows] = await Promise.all([
    favoritas,
    db
      .select({
        id: titles.id,
        catalogId: titles.catalogId,
        rating: sql<number | null>`coalesce(${titles.rating}, ${titles.impliedRating})`,
        people: catalog.tmdbPeople,
      })
      .from(titles)
      .innerJoin(catalog, eq(catalog.id, titles.catalogId))
      .where(
        and(
          eq(titles.userId, userId),
          or(gte(sql`coalesce(${titles.rating}, ${titles.impliedRating})`, LOVED_RATING), inArray(titles.catalogId, favoritas)),
        ),
      ),
  ]);

  const favoriteIds = new Set(favoriteRows.map((row) => row.catalogId));
  const ranked = rankFavoriteDirectors(
    rows.map((row) => ({
      rating: row.rating,
      favorite: favoriteIds.has(row.catalogId),
      people: parseStoredPeople(row.people),
    })),
    START_DIRECTORS,
  );

  const photos = await Promise.allSettled(ranked.map((director) => getTmdbPersonProfilePath(director.id)));
  return ranked.map((director, index) => {
    const photo = photos[index];
    return { ...director, profilePath: photo?.status === "fulfilled" ? photo.value : null };
  });
});

export type StartArrival = {
  titleId: string;
  name: string;
  platform: Platform;
  posterPath: string | null;
  availableSince: string;
};

const START_ARRIVALS = 6;
const START_ARRIVALS_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * Buscar's start screen (FIL-I21-8): «Llegó a tu plataforma», the Quiero ver titles that just
 * reached one of your platforms (last two weeks), newest first, with their poster.
 */
export const getStartArrivals = cache(async (userId: string): Promise<StartArrival[]> => {
  const arrivals = (await loadUserPlatformArrivals(userId, new Date(), START_ARRIVALS_WINDOW_MS)).slice(0, START_ARRIVALS);
  if (arrivals.length === 0) {
    return [];
  }
  const posters = await db
    .select({ id: catalog.id, posterPath: catalog.posterPath })
    .from(catalog)
    .where(inArray(catalog.id, arrivals.map((arrival) => arrival.catalogId)));
  const posterOf = new Map(posters.map((row) => [row.id, row.posterPath]));
  return arrivals.map((arrival) => ({
    titleId: arrival.titleId,
    name: arrival.name,
    platform: arrival.platform,
    posterPath: posterOf.get(arrival.catalogId) ?? null,
    availableSince: arrival.availableSince.toISOString(),
  }));
});
