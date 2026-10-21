import { getFavoriteDirectors } from "@/lib/buscar-start";
import { LOVED_RATING } from "@/lib/favorite-directors";
import { loadTitles, loadUserProfile } from "@/lib/queries";

/**
 * A person's taste at a glance (FIL-I20-8): their platforms, the genres of what they loved
 * (4★ and up) and Buscar's «Directores de tus favoritas». No personal data beyond taste.
 */
export const favoriteGenresOf = (rows: { rating: number | null; tmdbGenres: unknown }[], limit = 6) => {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (row.rating == null || row.rating < LOVED_RATING) continue;
    for (const genre of (row.tmdbGenres as { name?: string }[] | null) ?? []) {
      if (genre?.name) counts.set(genre.name, (counts.get(genre.name) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "es"))
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }));
};

export const loadTasteProfile = async (userId: string) => {
  const [profile, watched, directors] = await Promise.all([
    loadUserProfile(userId),
    loadTitles(userId, { onlyWatched: true, sort: "rating" }),
    getFavoriteDirectors(userId).catch(() => []),
  ]);
  return {
    platforms: profile?.streamingPlatforms ?? [],
    watchedCount: watched.length,
    favoriteGenres: favoriteGenresOf(watched),
    favoriteDirectors: directors.map((director) => ({ name: director.name, count: director.count })),
  };
};
