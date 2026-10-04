import { parseStoredTmdbGenres } from "@/lib/diary-picks";
import { persistTitleExtras, titleNeedsTmdbExtras, type TitleExtrasRow } from "@/lib/title-extras";
import { titleSynopsis } from "@/lib/title-overview";
import { getTmdbTitleExtras, isTmdbConfigured } from "@/lib/tmdb";

const OVERVIEW_HYDRATE_LIMIT = 32;
const OVERVIEW_HYDRATE_CONCURRENCY = 4;

const applyHydratedExtras = <T extends TitleExtrasRow>(
  title: T,
  extras: NonNullable<Awaited<ReturnType<typeof getTmdbTitleExtras>>>,
) => {
  if (!titleSynopsis(title.overview) && extras.overview) {
    title.overview = extras.overview;
  }

  if (!title.posterPath && extras.posterPath) {
    title.posterPath = extras.posterPath;
  }

  if (!title.backdropPath && extras.backdropPath) {
    title.backdropPath = extras.backdropPath;
  }

  if (!title.runtimeMinutes && extras.runtimeMinutes) {
    title.runtimeMinutes = extras.runtimeMinutes;
  }

  if (parseStoredTmdbGenres(title.tmdbGenres).length === 0 && extras.genres.length > 0) {
    title.tmdbGenres = extras.genres;
  }
};

export const hydrateMissingTitleOverviews = async <T extends TitleExtrasRow>(
  titleRows: T[],
) => {
  if (!isTmdbConfigured()) {
    return titleRows;
  }

  const missing = titleRows.filter(titleNeedsTmdbExtras);
  if (missing.length === 0) {
    return titleRows;
  }

  const batch = missing.slice(0, OVERVIEW_HYDRATE_LIMIT);
  let cursor = 0;

  const worker = async () => {
    while (cursor < batch.length) {
      const index = cursor;
      cursor += 1;
      const title = batch[index];
      if (!title?.tmdbId) {
        continue;
      }

      try {
        const extras = await getTmdbTitleExtras(title.tmdbId, title.kind);
        if (!extras) {
          continue;
        }

        await persistTitleExtras(title, extras);
        applyHydratedExtras(title, extras);
      } catch {
        // Keep the row without extras if TMDB is unavailable.
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(OVERVIEW_HYDRATE_CONCURRENCY, batch.length) }, () =>
      worker(),
    ),
  );

  return titleRows;
};

export const titleNeedsOverviewHydration = titleNeedsTmdbExtras;
