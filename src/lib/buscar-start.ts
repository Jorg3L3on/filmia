import { and, eq, gte, inArray, or } from "drizzle-orm";
import { cache } from "react";
import { catalog, db, listItems, lists, titles } from "@/db";
import { LOVED_RATING, rankFavoriteDirectors, type FavoriteDirector } from "@/lib/favorite-directors";
import { FAVORITAS_SLUG } from "@/lib/lists";
import { getTmdbPersonProfilePath } from "@/lib/tmdb";
import { parseStoredPeople } from "@/lib/tonight-store";

export type StartDirector = FavoriteDirector & { profilePath: string | null };

const START_DIRECTORS = 6;

/**
 * Buscar's start screen: directors of your Favoritas and 4★+ titles, with their TMDB photo
 * when there is one. A failed photo lookup never hides the director.
 */
export const getFavoriteDirectors = cache(async (userId: string): Promise<StartDirector[]> => {
  const favoritas = db
    .select({ titleId: listItems.titleId })
    .from(listItems)
    .innerJoin(lists, eq(lists.id, listItems.listId))
    .where(and(eq(lists.userId, userId), eq(lists.slug, FAVORITAS_SLUG)));

  const [favoriteRows, rows] = await Promise.all([
    favoritas,
    db
      .select({ id: titles.id, rating: titles.rating, people: catalog.tmdbPeople })
      .from(titles)
      .innerJoin(catalog, eq(catalog.id, titles.catalogId))
      .where(
        and(
          eq(titles.userId, userId),
          or(gte(titles.rating, LOVED_RATING), inArray(titles.id, favoritas)),
        ),
      ),
  ]);

  const favoriteIds = new Set(favoriteRows.map((row) => row.titleId));
  const ranked = rankFavoriteDirectors(
    rows.map((row) => ({
      rating: row.rating,
      favorite: favoriteIds.has(row.id),
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
