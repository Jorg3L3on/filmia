import type { CoverflowTitle } from "@/components/coverflow/types";
import type { Platform } from "@/db";
import type { TitleWithTags } from "@/lib/queries";
import { parseStoredTmdbGenres } from "@/lib/diary-picks";
import { currentAvailabilityPlatform } from "@/lib/streaming-platforms";
import { parseStoredWatchProviders } from "@/lib/watch-providers";

/** Shared title → coverflow card mapper (deck, historial, Esta noche). */
export const toCoverflowTitle = (
  title: TitleWithTags,
  userPlatforms: readonly Platform[] = [],
): CoverflowTitle => {
  const watchProviders = parseStoredWatchProviders(title.watchProvidersMx);
  return {
    id: title.id,
    name: title.name,
    kind: title.kind,
    year: title.year,
    rating: title.rating,
    posterPath: title.posterPath,
    platform: currentAvailabilityPlatform(watchProviders, title.platform, userPlatforms),
    imdbRating: title.imdbRating,
    watched: Boolean(title.watchedAt),
    review: title.review,
    seriesStatus: title.kind === "SERIES" ? title.seriesStatus : null,
    seriesSeason: title.kind === "SERIES" ? title.seriesSeason : null,
    flatrateProviders: watchProviders?.flatrate ?? [],
    genres: parseStoredTmdbGenres(title.tmdbGenres),
  };
};
