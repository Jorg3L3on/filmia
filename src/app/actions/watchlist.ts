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
import { ensureDefaultLists, WATCHLIST_SLUG } from "@/lib/lists";
import { reorderListItems } from "@/lib/list-order";
import {
  revalidateDiarySurfaces,
  revalidateWatchlistSurfaces,
} from "@/lib/revalidate-surfaces";
import { db, listItems, lists, titles } from "@/db";
import { requireUserId } from "@/lib/session";
import { scheduleTonightRecompute } from "@/lib/tonight-store";

const revalidateWatchlist = (titleId?: string) => {
  revalidateWatchlistSurfaces(titleId);
};

const revalidateDiary = (titleId: string) => {
  revalidateDiarySurfaces(titleId);
};

export const ensureWatchlist = async (userId: string) => {
  await ensureDefaultLists(userId);

  const watchlist = await db.query.lists.findFirst({
    where: and(eq(lists.userId, userId), eq(lists.slug, WATCHLIST_SLUG)),
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

  const title = await db.query.titles.findFirst({
    where: and(eq(titles.id, titleId), eq(titles.userId, userId)),
    columns: { id: true },
  });

  if (!title) {
    throw new Error("Título no encontrado.");
  }

  const last = await db.query.listItems.findFirst({
    where: eq(listItems.listId, watchlist.id),
    orderBy: [desc(listItems.position)],
  });

  const values = {
    listId: watchlist.id,
    titleId,
    position: (last?.position ?? -1) + 1,
    queueNote: queueNote?.trim() || null,
  };

  // Drizzle throws "No values to set" if onConflictDoUpdate gets `set: {}`.
  // The daily Quiero ver tap has no note, so use do-nothing on conflict.
  if (queueNote?.trim()) {
    await db
      .insert(listItems)
      .values(values)
      .onConflictDoUpdate({
        target: [listItems.listId, listItems.titleId],
        set: { queueNote: queueNote.trim() },
      });
  } else {
    await db.insert(listItems).values(values).onConflictDoNothing();
  }

  revalidateWatchlist(titleId);
  revalidatePath("/");
  scheduleTonightRecompute(userId);
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

  const watchlist = await db.query.lists.findFirst({
    where: and(eq(lists.userId, userId), eq(lists.slug, WATCHLIST_SLUG)),
    columns: { id: true },
  });

  if (!watchlist) {
    return;
  }

  await db
    .delete(listItems)
    .where(and(eq(listItems.listId, watchlist.id), eq(listItems.titleId, titleId)));

  revalidateWatchlist(titleId);
  revalidatePath("/");
  scheduleTonightRecompute(userId);
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

  const title = await db.query.titles.findFirst({
    where: and(eq(titles.id, titleId), eq(titles.userId, userId)),
    columns: { id: true },
  });

  if (!title) {
    throw new Error("Título no encontrado.");
  }

  const watchlist = await db.query.lists.findFirst({
    where: and(eq(lists.userId, userId), eq(lists.slug, WATCHLIST_SLUG)),
    columns: { id: true },
  });

  const updateTitle = db
    .update(titles)
    .set({
      watchedAt,
      ...(rating !== undefined ? { rating } : {}),
      ...(review !== undefined ? { review } : {}),
      ...(platform !== undefined ? { platform } : {}),
    })
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

  revalidateDiary(titleId);
  scheduleTonightRecompute(userId);
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
  await db
    .insert(listItems)
    .values({ listId: watchlist.id, titleId, position: (last?.position ?? -1) + 1 })
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
    .where(and(eq(listItems.listId, watchlist.id), eq(listItems.titleId, titleId)));

  revalidateWatchlist();
  scheduleTonightRecompute(userId);
};

/** «Subir al principio» from the ficha menu: the title becomes #1, everything else keeps its order. */
export const moveWatchlistItemToTop = async (titleId: string) => {
  const userId = await requireUserId();
  const watchlist = await ensureWatchlist(userId);
  const items = await db.query.listItems.findMany({
    where: eq(listItems.listId, watchlist.id),
    orderBy: [asc(listItems.position)],
    columns: { titleId: true },
  });
  if (!items.some((item) => item.titleId === titleId)) {
    throw new Error("Ese título no está en Quiero ver.");
  }
  await reorderListItems(watchlist.id, [
    titleId,
    ...items.map((item) => item.titleId).filter((id) => id !== titleId),
  ]);
  revalidateWatchlist();
  revalidatePath("/");
  scheduleTonightRecompute(userId);
};
