import { eq } from "drizzle-orm";
import { cache } from "react";
import { catalog, db } from "@/db";
import { scheduleAfterResponse } from "@/lib/after-response";
import { getTmdbTitleExtras, isTmdbConfigured } from "@/lib/tmdb";
import {
  parseStoredTmdbPeople,
  tmdbPeopleNeedUpgrade,
  tmdbPeopleUpgrade,
  type TmdbPerson,
} from "@/lib/tmdb-people";

type TitlePeopleRow = {
  catalogId: string;
  tmdbId: number | null;
  kind: "MOVIE" | "SERIES";
  tmdbPeople?: unknown;
};

/**
 * The ficha's people, completing rows stored before photos and the DP: fetch
 * TMDB (the same cached call `resolveTitleExtras` makes), answer with the fresh
 * list and persist it after the response. Await it inside a Suspense boundary
 * so the hero never waits on TMDB.
 */
export const resolveTitlePeople = cache(async (title: TitlePeopleRow): Promise<TmdbPerson[]> => {
  const stored = parseStoredTmdbPeople(title.tmdbPeople);
  const needsFetch = stored.length === 0 || tmdbPeopleNeedUpgrade(title.tmdbPeople);
  if (!needsFetch || !title.tmdbId || !isTmdbConfigured()) {
    return stored;
  }

  const fetched = await getTmdbTitleExtras(title.tmdbId, title.kind);
  const upgrade = tmdbPeopleUpgrade(title.tmdbPeople, fetched?.people);
  if (!upgrade) {
    return stored;
  }

  scheduleAfterResponse(async () => {
    try {
      await db.update(catalog).set({ tmdbPeople: upgrade }).where(eq(catalog.id, title.catalogId));
    } catch {
      // Best-effort: the next visit tries again.
    }
  });
  return upgrade;
});
