import { eq } from "drizzle-orm";
import { db, titles, type TitleKind } from "@/db";
import { scheduleAfterResponse } from "@/lib/after-response";
import { parseStoredTmdbGenres } from "@/lib/diary-picks";
import {
  getTmdbDetails,
  isTmdbConfigured,
  searchTmdb,
  type TmdbSearchResult,
} from "@/lib/tmdb";
import { titleNeedsWatchProvidersRefresh } from "@/lib/watch-providers";
import { refreshWatchProvidersMx } from "@/lib/watch-providers-cache";

type DiaryEnrichTitle = {
  id: string;
  name: string;
  originalName: string | null;
  year: number | null;
  tmdbId: number | null;
  kind: TitleKind;
  imdbId: string | null;
  imdbRating: number | null;
  tmdbGenres: unknown;
  watchProvidersMx: unknown;
  watchProvidersFetchedAt?: Date | null;
};

export const DIARY_ENRICH_LIMIT = 40;
export const DIARY_GENRE_ENRICH_LIMIT = 40;
export const DIARY_ENRICH_CONCURRENCY = 8;

const hasGenres = (value: unknown) => parseStoredTmdbGenres(value).length > 0;

const runPool = async <T>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
) => {
  if (items.length === 0) {
    return;
  }

  let cursor = 0;
  const run = async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      const item = items[index];
      if (item !== undefined) {
        await worker(item);
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => run()),
  );
};

export const pickDiaryTmdbMatch = (
  results: readonly TmdbSearchResult[],
  year: number | null,
) => {
  if (results.length === 0) {
    return null;
  }

  if (year != null) {
    const exact = results.find((item) => item.year === year);
    if (exact) {
      return exact;
    }
  }

  return results[0] ?? null;
};

const resolveDiaryTmdbId = async <T extends DiaryEnrichTitle>(title: T) => {
  if (title.tmdbId) {
    return title.tmdbId;
  }

  if (!isTmdbConfigured()) {
    return null;
  }

  const queries = [title.originalName, title.name]
    .map((value) => value?.trim() ?? "")
    .filter((value, index, all) => value && all.indexOf(value) === index);

  for (const query of queries) {
    const match = pickDiaryTmdbMatch(
      await searchTmdb(query, title.kind, title.year),
      title.year,
    );
    if (match) {
      return match.tmdbId;
    }
  }

  return null;
};

const enrichDiaryGenres = async <T extends DiaryEnrichTitle>(title: T): Promise<T> => {
  if (hasGenres(title.tmdbGenres) || !isTmdbConfigured()) {
    return title;
  }

  try {
    const tmdbId = await resolveDiaryTmdbId(title);
    if (!tmdbId) {
      return title;
    }

    const details = await getTmdbDetails(tmdbId, title.kind);
    const tmdbGenres = details.genres;

    await db
      .update(titles)
      .set({
        tmdbId,
        ...(tmdbGenres.length > 0 ? { tmdbGenres } : {}),
        ...(title.originalName ? {} : { originalName: details.originalName }),
      })
      .where(eq(titles.id, title.id));

    return {
      ...title,
      tmdbId,
      tmdbGenres: tmdbGenres.length > 0 ? tmdbGenres : title.tmdbGenres,
      originalName: title.originalName ?? details.originalName,
    };
  } catch {
    return title;
  }
};

const enrichDiaryProviders = async <T extends DiaryEnrichTitle>(title: T): Promise<T> => {
  if (!title.tmdbId) {
    return title;
  }

  if (
    !titleNeedsWatchProvidersRefresh(title.watchProvidersMx, title.watchProvidersFetchedAt)
  ) {
    return title;
  }

  try {
    const data = await refreshWatchProvidersMx(title.id, title.tmdbId, title.kind);
    return {
      ...title,
      watchProvidersMx: data,
      watchProvidersFetchedAt: new Date(),
    };
  } catch {
    return title;
  }
};

const pickEnrichIndexes = (
  titleRows: readonly DiaryEnrichTitle[],
  limit: number,
  matches: (title: DiaryEnrichTitle) => boolean,
) => {
  if (limit <= 0) {
    return [];
  }

  const indexes: number[] = [];
  for (let index = 0; index < titleRows.length; index += 1) {
    const title = titleRows[index];
    if (!title || !matches(title)) {
      continue;
    }

    indexes.push(index);
    if (indexes.length >= limit) {
      break;
    }
  }

  return indexes;
};

export const enrichDiaryWatchlistTitles = async <T extends DiaryEnrichTitle>(
  titleRows: T[],
): Promise<T[]> => {
  const nextTitles = [...titleRows];

  const withTmdbId = pickEnrichIndexes(
    nextTitles,
    DIARY_GENRE_ENRICH_LIMIT,
    (title) => Boolean(title.tmdbId) && !hasGenres(title.tmdbGenres),
  );
  const withoutTmdbId = pickEnrichIndexes(
    nextTitles,
    DIARY_GENRE_ENRICH_LIMIT - withTmdbId.length,
    (title) => !title.tmdbId && !hasGenres(title.tmdbGenres),
  );
  const genreIndexes = [...withTmdbId, ...withoutTmdbId];

  await runPool(genreIndexes, DIARY_ENRICH_CONCURRENCY, async (index) => {
    const title = nextTitles[index];
    if (!title) {
      return;
    }

    nextTitles[index] = await enrichDiaryGenres(title);
  });

  const providerIndexes = pickEnrichIndexes(
    nextTitles,
    DIARY_ENRICH_LIMIT,
    (title) =>
      Boolean(title.tmdbId) &&
      titleNeedsWatchProvidersRefresh(title.watchProvidersMx, title.watchProvidersFetchedAt),
  );

  await runPool(providerIndexes, DIARY_ENRICH_CONCURRENCY, async (index) => {
    const title = nextTitles[index];
    if (!title) {
      return;
    }

    nextTitles[index] = await enrichDiaryProviders(title);
  });

  return nextTitles;
};

export const scheduleDiaryWatchlistEnrichment = <T extends DiaryEnrichTitle>(
  titleRows: T[],
) => {
  const needsGenres = titleRows.some((title) => !hasGenres(title.tmdbGenres));
  const needsProviders = titleRows.some(
    (title) =>
      Boolean(title.tmdbId) &&
      titleNeedsWatchProvidersRefresh(title.watchProvidersMx, title.watchProvidersFetchedAt),
  );

  if (!needsGenres && !needsProviders) {
    return;
  }

  scheduleAfterResponse(async () => {
    await enrichDiaryWatchlistTitles(titleRows);
  });
};
