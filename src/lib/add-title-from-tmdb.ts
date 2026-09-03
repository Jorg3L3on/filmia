import { TitleKind } from "@/generated/prisma/client";
import { TITLE_KINDS } from "@/lib/labels";
import { ensureDefaultLists, WATCHLIST_SLUG } from "@/lib/lists";
import { resolveTitleMetadata } from "@/lib/metadata";
import { prisma } from "@/lib/prisma";
import { tmdbErrorMessage } from "@/lib/tmdb";
import { enrichWatchProvidersOnSave } from "@/lib/watch-providers-cache";

export type AddTitleFromTmdbInput = {
  tmdbId: number;
  kind: TitleKind;
  name: string;
  originalName?: string | null;
  year?: number | null;
  posterPath?: string | null;
  addToWatchlist?: boolean;
};

export type AddTitleFromTmdbResult =
  | {
      ok: true;
      titleId: string;
      created: boolean;
      addedToWatchlist: boolean;
    }
  | { ok: false; error: string };

const isTitleKind = (value: string): value is TitleKind =>
  TITLE_KINDS.includes(value as TitleKind);

const enqueueInWatchlist = async (userId: string, titleId: string) => {
  await ensureDefaultLists(userId);

  const watchlist = await prisma.list.findUnique({
    where: { userId_slug: { userId, slug: WATCHLIST_SLUG } },
    select: { id: true },
  });

  if (!watchlist) {
    throw new Error("No se pudo crear Quiero ver.");
  }

  const last = await prisma.listItem.findFirst({
    where: { listId: watchlist.id },
    orderBy: { position: "desc" },
  });

  await prisma.listItem.upsert({
    where: { listId_titleId: { listId: watchlist.id, titleId } },
    update: {},
    create: {
      listId: watchlist.id,
      titleId,
      position: (last?.position ?? -1) + 1,
    },
  });
};

export const upsertTitleFromTmdbForUser = async (
  userId: string,
  input: AddTitleFromTmdbInput,
): Promise<AddTitleFromTmdbResult> => {
  const tmdbId = Number(input.tmdbId);
  const kind = input.kind;
  const snapshotName = input.name.trim();

  if (!Number.isInteger(tmdbId) || tmdbId <= 0) {
    return { ok: false, error: "El identificador de TMDB no es válido." };
  }

  if (!isTitleKind(kind)) {
    return { ok: false, error: "El tipo debe ser película o serie." };
  }

  const existing = await prisma.title.findFirst({
    where: { userId, tmdbId },
    select: { id: true },
  });

  if (existing) {
    if (input.addToWatchlist) {
      await enqueueInWatchlist(userId, existing.id);
    }

    return {
      ok: true,
      titleId: existing.id,
      created: false,
      addedToWatchlist: Boolean(input.addToWatchlist),
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
    };
  } catch (error) {
    if (!snapshotName) {
      return { ok: false, error: tmdbErrorMessage(error) };
    }
  }

  if (!metadata.name) {
    return { ok: false, error: "TMDB no devolvió un nombre para este título." };
  }

  const title = await prisma.title.create({
    data: {
      userId,
      name: metadata.name,
      originalName: metadata.originalName,
      kind,
      year: metadata.year,
      tmdbId: metadata.tmdbId,
      posterPath: metadata.posterPath,
      imdbId: metadata.imdbId,
      imdbRating: metadata.imdbRating,
    },
  });

  if (metadata.tmdbId) {
    await enrichWatchProvidersOnSave(title.id, metadata.tmdbId, kind);
  }

  if (input.addToWatchlist) {
    await enqueueInWatchlist(userId, title.id);
  }

  return {
    ok: true,
    titleId: title.id,
    created: true,
    addedToWatchlist: Boolean(input.addToWatchlist),
  };
};
