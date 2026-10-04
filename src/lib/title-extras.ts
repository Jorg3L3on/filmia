import { and, eq } from "drizzle-orm";
import { cache } from "react";
import { db, titles } from "@/db";
import { scheduleAfterResponse } from "@/lib/after-response";
import {
  mergeTitleExtras,
  storedTitleExtras,
  titleExtrasPatch,
  titleNeedsTmdbExtras,
  type FetchedTitleExtras,
  type TitleExtrasRow,
} from "@/lib/title-extras-core";
import { getTmdbTitleExtras, isTmdbConfigured, type TmdbTitleExtras } from "@/lib/tmdb";

export {
  mergeTitleExtras,
  storedTitleExtras,
  titleExtrasPatch,
  titleNeedsTmdbExtras,
  type FetchedTitleExtras,
  type TitleExtrasPatch,
  type TitleExtrasRow,
} from "@/lib/title-extras-core";

export const persistTitleExtras = async (
  current: TitleExtrasRow,
  fetched: FetchedTitleExtras,
) => {
  const patch = titleExtrasPatch(current, fetched);
  if (Object.keys(patch).length === 0) {
    return false;
  }

  await db
    .update(titles)
    .set(patch)
    .where(and(eq(titles.id, current.id), eq(titles.userId, current.userId)));

  return true;
};

export const schedulePersistTitleExtras = (
  current: TitleExtrasRow,
  fetched: FetchedTitleExtras,
) => {
  if (Object.keys(titleExtrasPatch(current, fetched)).length === 0) {
    return;
  }

  scheduleAfterResponse(async () => {
    try {
      await persistTitleExtras(current, fetched);
    } catch {
      // Snapshot row already exists; extras persist is best-effort.
    }
  });
};

export const resolveTitleExtras = cache(async (
  title: TitleExtrasRow,
): Promise<TmdbTitleExtras> => {
  const stored = storedTitleExtras(title);
  if (!title.tmdbId || !isTmdbConfigured() || !titleNeedsTmdbExtras(title)) {
    return stored;
  }

  const fetched = await getTmdbTitleExtras(title.tmdbId, title.kind);
  if (!fetched) {
    return stored;
  }

  schedulePersistTitleExtras(title, fetched);
  return mergeTitleExtras(title, fetched);
});
