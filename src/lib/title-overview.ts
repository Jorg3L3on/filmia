import { TitleKind } from "@/generated/prisma/browser";
import { parseStoredTmdbGenres } from "@/lib/diary-picks";
import { prisma } from "@/lib/prisma";
import { getTmdbTitleExtras, isTmdbConfigured, type TmdbGenre } from "@/lib/tmdb";

const OVERVIEW_HYDRATE_LIMIT = 32;
const OVERVIEW_HYDRATE_CONCURRENCY = 4;

type OverviewTitle = {
  id: string;
  tmdbId: number | null;
  kind: TitleKind;
  overview: string | null;
  tmdbGenres?: unknown;
};

export const titleSynopsis = (overview?: string | null) => {
  const text = overview?.trim();
  return text ? text : null;
};

export const titleOverviewMap = (titles: readonly OverviewTitle[]) => {
  const overviews = new Map<string, string>();
  for (const title of titles) {
    const text = titleSynopsis(title.overview);
    if (text) {
      overviews.set(title.id, text);
    }
  }
  return overviews;
};

const titleNeedsHydration = (title: OverviewTitle) => {
  if (!title.tmdbId) {
    return false;
  }

  return (
    !titleSynopsis(title.overview) || parseStoredTmdbGenres(title.tmdbGenres).length === 0
  );
};

const applyHydratedFields = <T extends OverviewTitle>(
  title: T,
  overview: string | null,
  genres: TmdbGenre[],
) => {
  if (overview) {
    title.overview = overview;
  }

  if (genres.length > 0 && parseStoredTmdbGenres(title.tmdbGenres).length === 0) {
    title.tmdbGenres = genres;
  }
};

export const hydrateMissingTitleOverviews = async <T extends OverviewTitle>(
  titles: T[],
) => {
  if (!isTmdbConfigured()) {
    return titles;
  }

  const missing = titles.filter(titleNeedsHydration);
  if (missing.length === 0) {
    return titles;
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
        const overview = titleSynopsis(extras?.overview);
        const storedGenres = parseStoredTmdbGenres(title.tmdbGenres);
        const fetchedGenres = extras?.genres ?? [];
        const genres = storedGenres.length > 0 ? [] : fetchedGenres;

        if (!overview && genres.length === 0) {
          continue;
        }

        await prisma.title.update({
          where: { id: title.id },
          data: {
            ...(overview ? { overview } : {}),
            ...(genres.length > 0 ? { tmdbGenres: genres } : {}),
          },
        });
        applyHydratedFields(title, overview, genres);
      } catch {
        // Keep the row without a synopsis if TMDB is unavailable.
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(OVERVIEW_HYDRATE_CONCURRENCY, batch.length) }, () =>
      worker(),
    ),
  );

  return titles;
};
