import type { TitleKind } from "@/generated/prisma/browser";
import { Prisma } from "@/generated/prisma/browser";
import { prisma } from "@/lib/prisma";
import { isTmdbConfigured } from "@/lib/tmdb";
import {
  fetchMxWatchProviders,
  isWatchProvidersCacheFresh,
  parseStoredWatchProviders,
  type WatchProvidersMxData,
} from "@/lib/watch-providers";

type TitleWatchProviderSource = {
  id: string;
  tmdbId: number | null;
  kind: TitleKind;
  watchProvidersMx: unknown;
  watchProvidersFetchedAt: Date | null;
};

export type WatchProvidersResult = {
  data: WatchProvidersMxData | null;
  fromCache: boolean;
  stale: boolean;
};

const persistWatchProviders = async (
  titleId: string,
  data: WatchProvidersMxData | null,
) => {
  await prisma.title.update({
    where: { id: titleId },
    data: {
      watchProvidersMx: data === null ? Prisma.JsonNull : data,
      watchProvidersFetchedAt: new Date(),
    },
  });
};

export const refreshWatchProvidersMx = async (
  titleId: string,
  tmdbId: number,
  kind: TitleKind,
): Promise<WatchProvidersMxData | null> => {
  const data = await fetchMxWatchProviders(tmdbId, kind);
  await persistWatchProviders(titleId, data);
  return data;
};

export const getWatchProvidersForTitle = async (
  title: TitleWatchProviderSource,
): Promise<WatchProvidersResult> => {
  const cached = parseStoredWatchProviders(title.watchProvidersMx);
  const fresh = isWatchProvidersCacheFresh(title.watchProvidersFetchedAt);

  if (!title.tmdbId || !isTmdbConfigured()) {
    return { data: cached, fromCache: true, stale: !fresh };
  }

  if (fresh) {
    return { data: cached, fromCache: true, stale: false };
  }

  try {
    const data = await refreshWatchProvidersMx(title.id, title.tmdbId, title.kind);
    return { data, fromCache: false, stale: false };
  } catch {
    return { data: cached, fromCache: true, stale: true };
  }
};

export const enrichWatchProvidersOnSave = async (
  titleId: string,
  tmdbId: number,
  kind: TitleKind,
) => {
  if (!isTmdbConfigured()) {
    return;
  }

  try {
    await refreshWatchProvidersMx(titleId, tmdbId, kind);
  } catch {
    // Keep existing metadata if provider lookup fails.
  }
};
