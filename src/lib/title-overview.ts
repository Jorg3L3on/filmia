import { parseStoredTmdbGenres } from "@/lib/diary-picks";
import {
  persistTitleExtras,
  titleNeedsTmdbExtras,
  type TitleExtrasRow,
} from "@/lib/title-extras";
import { getTmdbTitleExtras, isTmdbConfigured } from "@/lib/tmdb";

const OVERVIEW_HYDRATE_LIMIT = 32;
const OVERVIEW_HYDRATE_CONCURRENCY = 4;

type OverviewMapTitle = {
  id: string;
  overview: string | null;
};

export const titleSynopsis = (overview?: string | null) => {
  const text = overview?.trim();
  return text ? text : null;
};

export const COMPACT_GENRE_LIMIT = 2;

export const compactGenreLabel = (
  value: unknown,
  limit = COMPACT_GENRE_LIMIT,
) => {
  const genres = parseStoredTmdbGenres(value);
  if (genres.length === 0 || limit <= 0) {
    return null;
  }

  const names = genres.slice(0, limit).map((genre) => genre.name);
  const label = names.join(" · ");
  return genres.length > limit ? `${label}…` : label;
};

export const titleOverviewMap = (titleRows: readonly OverviewMapTitle[]) => {
  const overviews = new Map<string, string>();
  for (const title of titleRows) {
    const text = titleSynopsis(title.overview);
    if (text) {
      overviews.set(title.id, text);
    }
  }
  return overviews;
};

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
