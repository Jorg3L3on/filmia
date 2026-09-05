import { createId } from "@paralleldrive/cuid2";
import { and, desc, eq } from "drizzle-orm";
import { db, listItems, lists, titles, type TitleKind } from "@/db";
import { TITLE_KINDS } from "@/lib/labels";
import { ensureDefaultLists, WATCHLIST_SLUG } from "@/lib/lists";
import { resolveTitleMetadata } from "@/lib/metadata";
import { tmdbErrorMessage, type TmdbGenre } from "@/lib/tmdb";
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

const markExistingWatched = async (userId: string, titleId: string) => {
  await ensureDefaultLists(userId);

  const watchlist = await db.query.lists.findFirst({
    where: and(eq(lists.userId, userId), eq(lists.slug, WATCHLIST_SLUG)),
    columns: { id: true },
  });

  await db.transaction(async (tx) => {
    await tx
      .update(titles)
      .set({ watchedAt: new Date() })
      .where(eq(titles.id, titleId));

    if (!watchlist) {
      return;
    }

    await tx
      .delete(listItems)
      .where(and(eq(listItems.listId, watchlist.id), eq(listItems.titleId, titleId)));
  });
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
      await markExistingWatched(userId, existing.id);
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

  let metadata = {
    tmdbId,
    name: snapshotName,
    originalName: input.originalName?.trim() || null,
    year: input.year ?? null,
    posterPath: input.posterPath ?? null,
    imdbId: null as string | null,
    imdbRating: null as number | null,
    tmdbGenres: [] as TmdbGenre[],
  };

  try {
    const resolved = await resolveTitleMetadata(tmdbId, kind);
    metadata = {
      tmdbId: resolved.tmdbId ?? tmdbId,
      name: resolved.name?.trim() || snapshotName,
      originalName: resolved.originalName ?? metadata.originalName,
      year: resolved.year ?? metadata.year,
      posterPath: resolved.posterPath ?? metadata.posterPath,
      imdbId: resolved.imdbId,
      imdbRating: resolved.imdbRating,
      tmdbGenres: resolved.tmdbGenres,
    };
  } catch (error) {
    if (!snapshotName) {
      return { ok: false, error: tmdbErrorMessage(error) };
    }
  }

  if (!metadata.name) {
    return { ok: false, error: "TMDB no devolvió un nombre para este título." };
  }

  const titleId = createId();
  await db.insert(titles).values({
    id: titleId,
    userId,
    name: metadata.name,
    originalName: metadata.originalName,
    kind,
    year: metadata.year,
    tmdbId: metadata.tmdbId,
    posterPath: metadata.posterPath,
    imdbId: metadata.imdbId,
    imdbRating: metadata.imdbRating,
    tmdbGenres: metadata.tmdbGenres,
    watchedAt: markWatched ? new Date() : null,
  });

  if (metadata.tmdbId) {
    await enrichWatchProvidersOnSave(titleId, metadata.tmdbId, kind);
  }

  if (addToWatchlist) {
    await enqueueInWatchlist(userId, titleId);
  }

  return {
    ok: true,
    titleId,
    created: true,
    addedToWatchlist: addToWatchlist,
    markedWatched: markWatched,
  };
};
