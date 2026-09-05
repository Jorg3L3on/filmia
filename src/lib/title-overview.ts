import { TitleKind } from "@/generated/prisma/browser";
import { prisma } from "@/lib/prisma";
import { getTmdbTitleExtras, isTmdbConfigured } from "@/lib/tmdb";

const OVERVIEW_HYDRATE_LIMIT = 16;
const OVERVIEW_HYDRATE_CONCURRENCY = 4;

type OverviewTitle = {
  id: string;
  tmdbId: number | null;
  kind: TitleKind;
  overview: string | null;
};

export const titleSynopsis = (overview?: string | null) => {
  const text = overview?.trim();
  return text ? text : null;
};

export const hydrateMissingTitleOverviews = async <T extends OverviewTitle>(
  titles: T[],
) => {
  if (!isTmdbConfigured()) {
    return titles;
  }

  const missing = titles.filter((title) => !titleSynopsis(title.overview) && title.tmdbId);
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
        if (!overview) {
          continue;
        }

        await prisma.title.update({
          where: { id: title.id },
          data: { overview },
        });
        title.overview = overview;
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
