"use server";

import { revalidatePath } from "next/cache";
import { ListKind } from "@/generated/prisma/client";
import { parseRating } from "@/lib/form-data";
import { prisma } from "@/lib/prisma";
import {
  WATCHLIST_DESCRIPTION,
  WATCHLIST_NAME,
  WATCHLIST_SLUG,
} from "@/lib/watchlist";

const revalidateWatchlist = () => {
  revalidatePath("/watchlist");
  revalidatePath("/");
  revalidatePath("/listas");
};

export const ensureWatchlist = async () => {
  return prisma.list.upsert({
    where: { slug: WATCHLIST_SLUG },
    update: {},
    create: {
      slug: WATCHLIST_SLUG,
      name: WATCHLIST_NAME,
      description: WATCHLIST_DESCRIPTION,
      kind: ListKind.WATCHLIST,
    },
  });
};

export const addToWatchlist = async (titleId: string, queueNote?: string) => {
  const watchlist = await ensureWatchlist();

  const last = await prisma.listItem.findFirst({
    where: { listId: watchlist.id },
    orderBy: { position: "desc" },
  });

  await prisma.listItem.upsert({
    where: { listId_titleId: { listId: watchlist.id, titleId } },
    update: queueNote ? { queueNote } : {},
    create: {
      listId: watchlist.id,
      titleId,
      position: (last?.position ?? -1) + 1,
      queueNote: queueNote?.trim() || null,
    },
  });

  revalidateWatchlist();
  revalidatePath(`/titulos/${titleId}`);
};

export const addToWatchlistById = async (titleId: string) => {
  await addToWatchlist(titleId);
};

export const addToWatchlistFromForm = async (formData: FormData) => {
  const titleId = String(formData.get("titleId") ?? "").trim();
  const queueNote = String(formData.get("queueNote") ?? "").trim();

  if (!titleId) {
    throw new Error("Elige un título para agregar.");
  }

  await addToWatchlist(titleId, queueNote || undefined);
};

export const removeFromWatchlist = async (titleId: string) => {
  const watchlist = await prisma.list.findUnique({
    where: { slug: WATCHLIST_SLUG },
    select: { id: true },
  });

  if (!watchlist) {
    return;
  }

  await prisma.listItem.delete({
    where: { listId_titleId: { listId: watchlist.id, titleId } },
  });

  revalidateWatchlist();
  revalidatePath(`/titulos/${titleId}`);
};

export const removeFromWatchlistById = async (titleId: string) => {
  await removeFromWatchlist(titleId);
};

export const markWatchlistItemWatched = async (
  titleId: string,
  formData?: FormData,
) => {
  await markTitleWatched(titleId, formData);
};

export const markTitleWatched = async (
  titleId: string,
  formData?: FormData,
) => {
  const rating = formData ? parseRating(formData.get("rating")) : null;

  const watchlist = await prisma.list.findUnique({
    where: { slug: WATCHLIST_SLUG },
    select: { id: true },
  });

  await prisma.$transaction(async (tx) => {
    await tx.title.update({
      where: { id: titleId },
      data: {
        watchedAt: new Date(),
        ...(rating != null ? { rating } : {}),
      },
    });

    if (!watchlist) {
      return;
    }

    await tx.listItem.deleteMany({
      where: { listId: watchlist.id, titleId },
    });
  });

  revalidateWatchlist();
  revalidatePath(`/titulos/${titleId}`);
};

export const updateWatchlistNote = async (titleId: string, formData: FormData) => {
  const watchlist = await ensureWatchlist();
  const queueNote = String(formData.get("queueNote") ?? "").trim() || null;

  await prisma.listItem.update({
    where: { listId_titleId: { listId: watchlist.id, titleId } },
    data: { queueNote },
  });

  revalidateWatchlist();
};

export const bumpWatchlistItem = async (titleId: string) => {
  const watchlist = await ensureWatchlist();
  const items = await prisma.listItem.findMany({
    where: { listId: watchlist.id },
    orderBy: { position: "asc" },
  });

  const index = items.findIndex((item) => item.titleId === titleId);
  if (index <= 0) {
    return;
  }

  const current = items[index];
  const previous = items[index - 1];

  await prisma.$transaction([
    prisma.listItem.update({
      where: {
        listId_titleId: { listId: watchlist.id, titleId: current.titleId },
      },
      data: { position: previous.position },
    }),
    prisma.listItem.update({
      where: {
        listId_titleId: { listId: watchlist.id, titleId: previous.titleId },
      },
      data: { position: current.position },
    }),
  ]);

  revalidateWatchlist();
};
