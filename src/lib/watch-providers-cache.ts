import { eq, sql } from "drizzle-orm";
import { cache } from "react";
import { catalog, db, type TitleKind } from "@/db";
import { scheduleAfterResponse } from "@/lib/after-response";
import { isTmdbConfigured } from "@/lib/tmdb";
import {
  fetchMxWatchProviders,
  isWatchProvidersCacheFresh,
  parseStoredWatchProviders,
  type WatchProvidersMxData,
} from "@/lib/watch-providers";

/** A flattened title or a catalog row: availability is cached per film. */
type TitleWatchProviderSource = {
  catalogId: string;
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
  catalogId: string,
  data: WatchProvidersMxData,
) => {
  const now = new Date();
  await db
    .update(catalog)
    .set({
      watchProvidersMx: data,
      watchProvidersFetchedAt: now,
      // Esta noche «Acaba de llegar»: remember the first time a flatrate offer showed up.
      availableSince:
        data.flatrate.length > 0
          ? sql`COALESCE(${catalog.availableSince}, ${now})`
          : sql`${catalog.availableSince}`,
    })
    .where(eq(catalog.id, catalogId));
};

export const refreshWatchProvidersMx = async (
  catalogId: string,
  tmdbId: number,
  kind: TitleKind,
): Promise<WatchProvidersMxData> => {
  const data = await fetchMxWatchProviders(tmdbId, kind);
  await persistWatchProviders(catalogId, data);
  return data;
};

export const getWatchProvidersForTitle = cache(async (
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

  if (cached) {
    const { catalogId, tmdbId, kind } = title;
    scheduleAfterResponse(async () => {
      try {
        await refreshWatchProvidersMx(catalogId, tmdbId, kind);
      } catch {
        // Keep the stale cache on the current paint.
      }
    });
    return { data: cached, fromCache: true, stale: true };
  }

  try {
    const data = await refreshWatchProvidersMx(title.catalogId, title.tmdbId, title.kind);
    return { data, fromCache: false, stale: false };
  } catch {
    return { data: cached, fromCache: true, stale: true };
  }
});

export const enrichWatchProvidersOnSave = async (
  catalogId: string,
  tmdbId: number,
  kind: TitleKind,
) => {
  if (!isTmdbConfigured()) {
    return;
  }

  try {
    await refreshWatchProvidersMx(catalogId, tmdbId, kind);
  } catch {
    // Keep existing metadata if provider lookup fails.
  }
};
