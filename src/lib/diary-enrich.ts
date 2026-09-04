import { TitleKind } from "@/generated/prisma/client";
import { parseStoredTmdbGenres } from "@/lib/diary-picks";
import { resolveTitleMetadata } from "@/lib/metadata";
import { prisma } from "@/lib/prisma";
import { parseStoredWatchProviders } from "@/lib/watch-providers";
import { refreshWatchProvidersMx } from "@/lib/watch-providers-cache";

type DiaryEnrichTitle = {
  id: string;
  tmdbId: number | null;
  kind: TitleKind;
  imdbId: string | null;
  imdbRating: number | null;
  tmdbGenres: unknown;
  watchProvidersMx: unknown;
};

const hasGenres = (value: unknown) => parseStoredTmdbGenres(value).length > 0;

export const enrichDiaryWatchlistTitles = async <T extends DiaryEnrichTitle>(
  titles: T[],
): Promise<T[]> => {
  return Promise.all(
    titles.map(async (title) => {
      if (!title.tmdbId) {
        return title;
      }

      const needsGenres = !hasGenres(title.tmdbGenres);
      const needsImdb = title.imdbRating == null;
      const needsProviders = !parseStoredWatchProviders(title.watchProvidersMx);
      let next = title;

      if (needsGenres || needsImdb) {
        try {
          const resolved = await resolveTitleMetadata(title.tmdbId, title.kind);
          const tmdbGenres = resolved.tmdbGenres;
          const imdbRating = resolved.imdbRating ?? title.imdbRating;
          const imdbId = resolved.imdbId ?? title.imdbId;

          await prisma.title.update({
            where: { id: title.id },
            data: {
              ...(needsGenres ? { tmdbGenres } : {}),
              ...(needsImdb && imdbRating != null ? { imdbRating, imdbId } : {}),
            },
          });

          next = {
            ...next,
            tmdbGenres: needsGenres ? tmdbGenres : next.tmdbGenres,
            imdbRating: needsImdb ? imdbRating : next.imdbRating,
            imdbId: needsImdb ? imdbId : next.imdbId,
          };
        } catch {
          // Keep the stored snapshot if TMDB/OMDB fail.
        }
      }

      if (!needsProviders) {
        return next;
      }

      try {
        const data = await refreshWatchProvidersMx(title.id, title.tmdbId, title.kind);
        return { ...next, watchProvidersMx: data };
      } catch {
        return next;
      }
    }),
  );
};
