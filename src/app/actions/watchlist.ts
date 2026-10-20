"use server";

import { and, asc, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { todayDateInput } from "@/lib/dates";
import {
  parseOptionalDate,
  parseOptionalReview,
  parsePlatform,
  parseRating,
} from "@/lib/form-data";
import { ensureDefaultLists } from "@/lib/lists";
import { reorderListItems } from "@/lib/list-order";
import {
  revalidateDiarySurfaces,
  revalidateWatchlistSurfaces,
} from "@/lib/revalidate-surfaces";
import { db, listItems, titles } from "@/db";
import { catalogIdOfOwnTitle, catalogIdOfTitle } from "@/lib/list-items";
import {
  addToWatchlistFor,
  ensureWatchlistFor,
  markWatchedFor,
  removeFromWatchlistFor,
} from "@/lib/title-writes";
import { requireUserId } from "@/lib/session";
import { scheduleTonightRecompute } from "@/lib/tonight-store";

const revalidateWatchlist = (titleId?: string) => {
  revalidateWatchlistSurfaces(titleId);
};

const revalidateDiary = (titleId: string) => {
  revalidateDiarySurfaces(titleId);
};

// Not exported: every export of a "use server" file is callable with any arguments.
const ensureWatchlist = ensureWatchlistFor;

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
  await addToWatchlistFor(userId, titleId, queueNote);
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
  await removeFromWatchlistFor(userId, titleId);
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
  // Only touch «Dónde la vi» when the field was sent; "" (Ninguna) → null.
  const platform = formData?.has("platform")
    ? parsePlatform(formData.get("platform"))
    : undefined;
  const watchedAt =
    parseOptionalDate(formData?.get("watchedAt") ?? null) ??
    parseOptionalDate(todayDateInput());

  if (!watchedAt) {
    throw new Error("La fecha vista no es válida.");
  }

  await markWatchedFor(userId, titleId, { watchedAt, rating, review, platform });
};

/** Undo for «Vi esto» from the sala: clear the entry and put it back in Quiero ver. */
export const undoMarkWatched = async (titleId: string) => {
  const userId = await requireUserId();
  const watchlist = await ensureWatchlist(userId);
  const updated = await db
    .update(titles)
    .set({ watchedAt: null })
    .where(and(eq(titles.id, titleId), eq(titles.userId, userId)))
    .returning({ id: titles.id });

  if (updated.length === 0) {
    throw new Error("Título no encontrado.");
  }

  const last = await db.query.listItems.findFirst({
    where: eq(listItems.listId, watchlist.id),
    orderBy: [desc(listItems.position)],
  });
  const catalogId = await catalogIdOfOwnTitle(userId, titleId);
  if (!catalogId) {
    throw new Error("Título no encontrado.");
  }
  await db
    .insert(listItems)
    .values({
      listId: watchlist.id,
      catalogId,
      addedByUserId: userId,
      position: (last?.position ?? -1) + 1,
    })
    .onConflictDoNothing();

  revalidateDiary(titleId);
  scheduleTonightRecompute(userId);
};

export const clearTitleWatched = async (titleId: string) => {
  const userId = await requireUserId();

  const updated = await db
    .update(titles)
    .set({ watchedAt: null })
    .where(and(eq(titles.id, titleId), eq(titles.userId, userId)))
    .returning({ id: titles.id });

  if (updated.length === 0) {
    throw new Error("Título no encontrado.");
  }

  revalidateDiary(titleId);
  scheduleTonightRecompute(userId);
};

export const updateWatchlistNote = async (titleId: string, formData: FormData) => {
  const userId = await requireUserId();
  const watchlist = await ensureWatchlist(userId);
  const queueNote = String(formData.get("queueNote") ?? "").trim() || null;

  await db
    .update(listItems)
    .set({ queueNote })
    .where(and(eq(listItems.listId, watchlist.id), eq(listItems.catalogId, catalogIdOfTitle(titleId))));

  revalidateWatchlist();
  scheduleTonightRecompute(userId);
};

/** «Subir al principio» from the ficha menu: the title becomes #1, everything else keeps its order. */
export const moveWatchlistItemToTop = async (titleId: string) => {
  const userId = await requireUserId();
  const watchlist = await ensureWatchlist(userId);
  const catalogId = await catalogIdOfOwnTitle(userId, titleId);
  const items = await db.query.listItems.findMany({
    where: eq(listItems.listId, watchlist.id),
    orderBy: [asc(listItems.position)],
    columns: { catalogId: true },
  });
  if (!catalogId || !items.some((item) => item.catalogId === catalogId)) {
    throw new Error("Ese título no está en Quiero ver.");
  }
  await reorderListItems(watchlist.id, [
    catalogId,
    ...items.map((item) => item.catalogId).filter((id) => id !== catalogId),
  ]);
  revalidateWatchlist();
  revalidatePath("/");
  scheduleTonightRecompute(userId);
};
