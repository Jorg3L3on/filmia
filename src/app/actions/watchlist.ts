"use server";

import { revalidatePath } from "next/cache";
import { todayDateInput } from "@/lib/dates";
import { parseOptionalDate, parseOptionalReview, parseRating } from "@/lib/form-data";
import { ensureDefaultLists, WATCHLIST_SLUG } from "@/lib/lists";
import { swapAdjacentListItems } from "@/lib/list-order";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";

const revalidateWatchlist = () => {
  revalidatePath("/watchlist");
  revalidatePath("/");
  revalidatePath("/listas", "layout");
};

const revalidateDiary = (titleId: string) => {
  revalidateWatchlist();
  revalidatePath(`/titulos/${titleId}`);
  revalidatePath(`/titulos/${titleId}/editar`);
};

export const ensureWatchlist = async (userId: string) => {
  await ensureDefaultLists(userId);

  const watchlist = await prisma.list.findUnique({
    where: { userId_slug: { userId, slug: WATCHLIST_SLUG } },
  });

  if (!watchlist) {
    throw new Error("No se pudo crear Quiero ver.");
  }

  return watchlist;
};

export const ensureCurrentUserWatchlist = async () => {
  const userId = await requireUserId();
  return ensureWatchlist(userId);
};

export const ensureCurrentUserDefaultLists = async () => {
  const userId = await requireUserId();
  return ensureDefaultLists(userId);
};

export const addToWatchlist = async (titleId: string, queueNote?: string) => {
  const userId = await requireUserId();
  const watchlist = await ensureWatchlist(userId);

  const title = await prisma.title.findFirst({
    where: { id: titleId, userId },
    select: { id: true },
  });

  if (!title) {
    throw new Error("Título no encontrado.");
  }

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
  const userId = await requireUserId();

  const watchlist = await prisma.list.findUnique({
    where: { userId_slug: { userId, slug: WATCHLIST_SLUG } },
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
  const userId = await requireUserId();
  const rating = formData ? parseRating(formData.get("rating")) : undefined;
  const review = formData ? parseOptionalReview(formData.get("review")) : undefined;
  const watchedAt =
    parseOptionalDate(formData?.get("watchedAt") ?? null) ??
    parseOptionalDate(todayDateInput());

  if (!watchedAt) {
    throw new Error("La fecha vista no es válida.");
  }

  const title = await prisma.title.findFirst({
    where: { id: titleId, userId },
    select: { id: true },
  });

  if (!title) {
    throw new Error("Título no encontrado.");
  }

  const watchlist = await prisma.list.findUnique({
    where: { userId_slug: { userId, slug: WATCHLIST_SLUG } },
    select: { id: true },
  });

  await prisma.$transaction(async (tx) => {
    await tx.title.update({
      where: { id: titleId },
      data: {
        watchedAt,
        ...(rating !== undefined ? { rating } : {}),
        ...(review !== undefined ? { review } : {}),
      },
    });

    if (!watchlist) {
      return;
    }

    await tx.listItem.deleteMany({
      where: { listId: watchlist.id, titleId },
    });
  });

  revalidateDiary(titleId);
};

/**
 * Quita el título del diario: solo limpia `watchedAt`.
 * Conserva `rating` y `review` para que sigan editables en la ficha
 * o al volver a marcar “Vi esto”.
 */
export const clearTitleWatched = async (titleId: string) => {
  const userId = await requireUserId();

  const result = await prisma.title.updateMany({
    where: { id: titleId, userId },
    data: { watchedAt: null },
  });

  if (result.count === 0) {
    throw new Error("Título no encontrado.");
  }

  revalidateDiary(titleId);
};

export const updateWatchlistNote = async (titleId: string, formData: FormData) => {
  const userId = await requireUserId();
  const watchlist = await ensureWatchlist(userId);
  const queueNote = String(formData.get("queueNote") ?? "").trim() || null;

  await prisma.listItem.update({
    where: { listId_titleId: { listId: watchlist.id, titleId } },
    data: { queueNote },
  });

  revalidateWatchlist();
};

export const bumpWatchlistItem = async (titleId: string) => {
  const userId = await requireUserId();
  const watchlist = await ensureWatchlist(userId);
  await swapAdjacentListItems(watchlist.id, titleId, "up");
  revalidateWatchlist();
};
