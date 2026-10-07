import { eq } from "drizzle-orm";
import { cache } from "react";
import { catalog, db } from "@/db";
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
  // The catalog is keyed by tmdbId; everything else in the patch is a catalog column.
  const patch = { ...titleExtrasPatch(current, fetched) };
  delete patch.tmdbId;
  if (Object.keys(patch).length === 0) {
    return false;
  }

  await db.update(catalog).set(patch).where(eq(catalog.id, current.catalogId));

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
