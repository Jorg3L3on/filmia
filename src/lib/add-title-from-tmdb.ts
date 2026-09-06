import { createId } from "@paralleldrive/cuid2";
import { and, desc, eq } from "drizzle-orm";
import { after } from "next/server";
import { db, listItems, lists, titles, type TitleKind } from "@/db";
import { parseOptionalDate } from "@/lib/form-data";
import { TITLE_KINDS } from "@/lib/labels";
import { ensureDefaultLists, WATCHLIST_SLUG } from "@/lib/lists";
import { resolveTitleMetadata } from "@/lib/metadata";
import { revalidateTitlePages } from "@/lib/revalidate-surfaces";
import type { TmdbGenre } from "@/lib/tmdb";
import { enrichWatchProvidersOnSave } from "@/lib/watch-providers-cache";

export type AddTitleDestination = "watchlist" | "watched";

export type AddTitleFromTmdbInput = {
  tmdbId: number;
  kind: TitleKind;
  name: string;
  originalName?: string | null;
  year?: number | null;
  posterPath?: string | null;
  addToWatchlist?: boolean;
  destination?: AddTitleDestination;
  watchedAt?: string | null;
};

export type AddTitleFromTmdbResult =
  | {
      ok: true;
      titleId: string;
      created: boolean;
      addedToWatchlist: boolean;
      markedWatched: boolean;
    }
  | { ok: false; error: string };

const isTitleKind = (value: string): value is TitleKind =>
  TITLE_KINDS.includes(value as TitleKind);

const resolveDestination = (input: AddTitleFromTmdbInput) => {
  if (input.destination === "watched") {
    return { addToWatchlist: false, markWatched: true };
  }

  return {
    addToWatchlist: Boolean(input.addToWatchlist || input.destination === "watchlist"),
    markWatched: false,
  };
};

const enqueueInWatchlist = async (userId: string, titleId: string) => {
  await ensureDefaultLists(userId);

  const watchlist = await db.query.lists.findFirst({
    where: and(eq(lists.userId, userId), eq(lists.slug, WATCHLIST_SLUG)),
    columns: { id: true },
  });

  if (!watchlist) {
    throw new Error("No se pudo crear Quiero ver.");
  }

  const last = await db.query.listItems.findFirst({
    where: eq(listItems.listId, watchlist.id),
    orderBy: [desc(listItems.position)],
  });

  await db
    .insert(listItems)
    .values({
      listId: watchlist.id,
      titleId,
      position: (last?.position ?? -1) + 1,
    })
    .onConflictDoNothing();
};

const resolveWatchedAt = (value?: string | null) =>
  parseOptionalDate(value ?? null) ?? new Date();

const scheduleAfterResponse = (task: () => Promise<void>) => {
  try {
    after(task);
  } catch {
    void task();
  }
};

const enrichCreatedTitleInBackground = (
  titleId: string,
  tmdbId: number,
  kind: TitleKind,
  snapshotName: string,
) => {
  scheduleAfterResponse(async () => {
    try {
      const [resolved] = await Promise.all([
        resolveTitleMetadata(tmdbId, kind).catch(() => null),
        enrichWatchProvidersOnSave(titleId, tmdbId, kind),
      ]);

      if (resolved) {
        await db
          .update(titles)
          .set({
            name: resolved.name?.trim() || snapshotName,
            originalName: resolved.originalName,
            year: resolved.year,
            posterPath: resolved.posterPath,
            imdbId: resolved.imdbId,
            imdbRating: resolved.imdbRating,
            overview: resolved.overview ?? null,
            tmdbGenres: resolved.tmdbGenres,
            tmdbId: resolved.tmdbId ?? tmdbId,
          })
          .where(eq(titles.id, titleId));
      }

      revalidateTitlePages(titleId);
    } catch {
      // Snapshot row already exists; enrichment is best-effort.
    }
  });
};

const markExistingWatched = async (
  userId: string,
  titleId: string,
  watchedAt?: string | null,
) => {
  await ensureDefaultLists(userId);

  const watchlist = await db.query.lists.findFirst({
    where: and(eq(lists.userId, userId), eq(lists.slug, WATCHLIST_SLUG)),
    columns: { id: true },
  });

  const updateTitle = db
    .update(titles)
    .set({ watchedAt: resolveWatchedAt(watchedAt) })
    .where(eq(titles.id, titleId));

  if (!watchlist) {
    await updateTitle;
  } else {
    await db.batch([
      updateTitle,
      db
        .delete(listItems)
        .where(
          and(eq(listItems.listId, watchlist.id), eq(listItems.titleId, titleId)),
        ),
    ]);
  }
};

export const upsertTitleFromTmdbForUser = async (
  userId: string,
  input: AddTitleFromTmdbInput,
): Promise<AddTitleFromTmdbResult> => {
  const tmdbId = Number(input.tmdbId);
  const kind = input.kind;
  const snapshotName = input.name.trim();
  const { addToWatchlist, markWatched } = resolveDestination(input);

  if (!Number.isInteger(tmdbId) || tmdbId <= 0) {
    return { ok: false, error: "El identificador de TMDB no es válido." };
  }

  if (!isTitleKind(kind)) {
    return { ok: false, error: "El tipo debe ser película o serie." };
  }

  const existing = await db.query.titles.findFirst({
    where: and(eq(titles.userId, userId), eq(titles.tmdbId, tmdbId)),
    columns: { id: true },
  });

  if (existing) {
    if (markWatched) {
      await markExistingWatched(userId, existing.id, input.watchedAt);
    } else if (addToWatchlist) {
      await enqueueInWatchlist(userId, existing.id);
    }

    return {
      ok: true,
      titleId: existing.id,
      created: false,
      addedToWatchlist: addToWatchlist,
      markedWatched: markWatched,
    };
  }

  if (!snapshotName) {
    return { ok: false, error: "Falta el nombre del título." };
  }

  const titleId = createId();
  await db.insert(titles).values({
    id: titleId,
    userId,
    name: snapshotName,
    originalName: input.originalName?.trim() || null,
    kind,
    year: input.year ?? null,
    tmdbId,
    posterPath: input.posterPath ?? null,
    imdbId: null,
    imdbRating: null,
    overview: null,
    tmdbGenres: [] as TmdbGenre[],
    watchedAt: markWatched ? resolveWatchedAt(input.watchedAt) : null,
  });

  if (addToWatchlist) {
    await enqueueInWatchlist(userId, titleId);
  }

  enrichCreatedTitleInBackground(titleId, tmdbId, kind, snapshotName);

  return {
    ok: true,
    titleId,
    created: true,
    addedToWatchlist: addToWatchlist,
    markedWatched: markWatched,
  };
};
