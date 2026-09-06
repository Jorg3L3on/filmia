"use server";

import { createId } from "@paralleldrive/cuid2";
import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, listItems, lists, titles } from "@/db";
import { parseRequiredName } from "@/lib/form-data";
import { slugify } from "@/lib/labels";
import { isFixedListSlug, isReservedListSlug, listHref, WATCHLIST_SLUG } from "@/lib/lists";
import { type ListMoveDirection, swapAdjacentListItems, swapListItemPositions } from "@/lib/list-order";
import { requireUserId } from "@/lib/session";

const revalidateLists = (
  listId?: string,
  titleId?: string,
  slug?: string | null,
) => {
  revalidatePath("/listas");
  if (slug === WATCHLIST_SLUG) {
    revalidatePath("/watchlist");
  }
  if (listId) {
    revalidatePath(`/listas/${listId}`);
    revalidatePath(`/listas/${listId}/editar`);
  }
  if (titleId) {
    revalidatePath(`/titulos/${titleId}`);
    revalidatePath(`/titulos/${titleId}/editar`);
  }
};

const requireOwnedList = async (listId: string, userId: string) => {
  const list = await db.query.lists.findFirst({
    where: and(eq(lists.id, listId), eq(lists.userId, userId)),
    columns: { id: true, slug: true, kind: true, name: true },
  });

  if (!list) {
    throw new Error("Lista no encontrada.");
  }

  return list;
};

export const createList = async (formData: FormData) => {
  const userId = await requireUserId();
  const name = parseRequiredName(formData.get("name"));
  const description = String(formData.get("description") ?? "").trim() || null;

  if (isReservedListSlug(slugify(name))) {
    throw new Error("Ese nombre está reservado para una lista diaria.");
  }

  const listId = createId();
  await db.insert(lists).values({
    id: listId,
    userId,
    name,
    description,
    kind: "COLLECTION",
  });

  revalidateLists(listId);
  redirect(`/listas/${listId}`);
};

export const updateList = async (listId: string, formData: FormData) => {
  const userId = await requireUserId();
  const description = String(formData.get("description") ?? "").trim() || null;
  const existing = await requireOwnedList(listId, userId);
  const name = isFixedListSlug(existing.slug)
    ? existing.name
    : parseRequiredName(formData.get("name"));

  if (!isFixedListSlug(existing.slug) && isReservedListSlug(slugify(name))) {
    throw new Error("Ese nombre está reservado para una lista diaria.");
  }

  await db.update(lists).set({ name, description }).where(eq(lists.id, listId));

  revalidateLists(listId);
  redirect(listHref(existing));
};

export const deleteList = async (listId: string) => {
  const userId = await requireUserId();
  const existing = await requireOwnedList(listId, userId);

  if (isFixedListSlug(existing.slug)) {
    throw new Error("Las listas diarias no se pueden borrar.");
  }

  await db.delete(lists).where(eq(lists.id, listId));
  revalidateLists(listId);
  redirect("/listas");
};

export const addTitleToList = async (listId: string, formData: FormData) => {
  const userId = await requireUserId();
  const titleId = String(formData.get("titleId") ?? "").trim();
  if (!titleId) {
    throw new Error("Elige un título para agregar.");
  }

  const list = await requireOwnedList(listId, userId);

  const title = await db.query.titles.findFirst({
    where: and(eq(titles.id, titleId), eq(titles.userId, userId)),
    columns: { id: true },
  });

  if (!title) {
    throw new Error("Título no encontrado.");
  }

  const last = await db.query.listItems.findFirst({
    where: eq(listItems.listId, listId),
    orderBy: [desc(listItems.position)],
  });

  await db
    .insert(listItems)
    .values({
      listId,
      titleId,
      position: (last?.position ?? -1) + 1,
    })
    .onConflictDoNothing();

  revalidateLists(listId, titleId, list.slug);
};

export const removeTitleFromList = async (listId: string, titleId: string) => {
  const userId = await requireUserId();
  const list = await requireOwnedList(listId, userId);

  await db
    .delete(listItems)
    .where(and(eq(listItems.listId, listId), eq(listItems.titleId, titleId)));
  revalidateLists(listId, titleId, list.slug);
};

export const toggleTitleInList = async (listId: string, titleId: string) => {
  const userId = await requireUserId();
  const list = await requireOwnedList(listId, userId);

  const title = await db.query.titles.findFirst({
    where: and(eq(titles.id, titleId), eq(titles.userId, userId)),
    columns: { id: true },
  });

  if (!title) {
    throw new Error("Título no encontrado.");
  }

  const existing = await db.query.listItems.findFirst({
    where: and(eq(listItems.listId, listId), eq(listItems.titleId, titleId)),
  });

  if (existing) {
    await db
      .delete(listItems)
      .where(and(eq(listItems.listId, listId), eq(listItems.titleId, titleId)));
  } else {
    const last = await db.query.listItems.findFirst({
      where: eq(listItems.listId, listId),
      orderBy: [desc(listItems.position)],
    });

    await db.insert(listItems).values({
      listId,
      titleId,
      position: (last?.position ?? -1) + 1,
    });
  }

  revalidateLists(listId, titleId, list.slug);
};

export const moveListItem = async (
  listId: string,
  titleId: string,
  direction: ListMoveDirection,
  neighborTitleId?: string | null,
) => {
  const userId = await requireUserId();
  const list = await requireOwnedList(listId, userId);
  if (neighborTitleId) {
    await swapListItemPositions(listId, titleId, neighborTitleId);
  } else {
    await swapAdjacentListItems(listId, titleId, direction);
  }
  revalidateLists(listId, titleId, list.slug);
};
