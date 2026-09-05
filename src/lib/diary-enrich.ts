import { eq } from "drizzle-orm";
import { db, titles, type TitleKind } from "@/db";
import { parseStoredTmdbGenres } from "@/lib/diary-picks";
import { resolveTitleMetadata } from "@/lib/metadata";
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
  titleRows: T[],
): Promise<T[]> => {
  return Promise.all(
    titleRows.map(async (title) => {
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

          await db
            .update(titles)
            .set({
              ...(needsGenres ? { tmdbGenres } : {}),
              ...(needsImdb && imdbRating != null ? { imdbRating, imdbId } : {}),
            })
            .where(eq(titles.id, title.id));

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
