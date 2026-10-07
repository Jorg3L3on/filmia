"use server";

import { createId } from "@paralleldrive/cuid2";
import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, listItems, lists, titles } from "@/db";
import { parseRequiredName } from "@/lib/form-data";
import { slugify } from "@/lib/labels";
import {
  hasDuplicateListName,
  isRenameBlocked,
  LIST_NAME_TAKEN_MESSAGE,
  type ListFormState,
} from "@/lib/list-names";
import { isFixedListSlug, isReservedListSlug, listHref, WATCHLIST_SLUG } from "@/lib/lists";
import {
  type ListMoveDirection,
  reorderListItems,
  swapAdjacentListItems,
  swapListItemPositions,
} from "@/lib/list-order";
import { requireUserId } from "@/lib/session";
import { scheduleTonightRecompute } from "@/lib/tonight-store";

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

type ListSaveOutcome = { error: string } | { redirectTo: string };

const readListFormValues = (formData: FormData) => ({
  name: String(formData.get("name") ?? ""),
  description: String(formData.get("description") ?? ""),
});

const parseListName = (
  value: FormDataEntryValue | null,
): { name: string } | { error: string } => {
  try {
    return { name: parseRequiredName(value) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Datos no válidos." };
  }
};

/**
 * Error de nombre para una lista propia: choque con otra lista del usuario
 * (diarias incluidas, comparando con `slugify`) o nombre reservado.
 */
const userListNameError = async (
  userId: string,
  name: string,
  current?: { id: string; name: string },
) => {
  const existing = await db.query.lists.findMany({
    where: eq(lists.userId, userId),
    columns: { id: true, name: true },
  });

  const taken = current
    ? isRenameBlocked(name, existing, current)
    : hasDuplicateListName(name, existing);
  if (taken) {
    return LIST_NAME_TAKEN_MESSAGE;
  }

  if (isReservedListSlug(slugify(name))) {
    return "Ese nombre está reservado para una lista diaria.";
  }

  return null;
};

const saveNewList = async (formData: FormData): Promise<ListSaveOutcome> => {
  const userId = await requireUserId();
  const parsed = parseListName(formData.get("name"));
  if ("error" in parsed) {
    return parsed;
  }

  const { name } = parsed;
  const description = String(formData.get("description") ?? "").trim() || null;

  const nameError = await userListNameError(userId, name);
  if (nameError) {
    return { error: nameError };
  }

  const listId = createId();
  const now = new Date();
  await db.insert(lists).values({
    id: listId,
    userId,
    name,
    description,
    kind: "COLLECTION",
    createdAt: now,
    updatedAt: now,
  });

  revalidateLists(listId);
  return { redirectTo: `/listas/${listId}` };
};

const saveListChanges = async (
  listId: string,
  formData: FormData,
): Promise<ListSaveOutcome> => {
  const userId = await requireUserId();
  const description = String(formData.get("description") ?? "").trim() || null;
  const existing = await requireOwnedList(listId, userId);
  const fixed = isFixedListSlug(existing.slug);

  let name = existing.name;
  if (!fixed) {
    const parsed = parseListName(formData.get("name"));
    if ("error" in parsed) {
      return parsed;
    }

    name = parsed.name;
    const nameError = await userListNameError(userId, name, existing);
    if (nameError) {
      return { error: nameError };
    }
  }

  await db.update(lists).set({ name, description }).where(eq(lists.id, listId));

  revalidateLists(listId);
  return { redirectTo: listHref(existing) };
};

/** Crea una lista propia (`useActionState`): los errores de nombre vuelven al formulario. */
export const createListWithFeedback = async (
  _prev: ListFormState,
  formData: FormData,
): Promise<ListFormState> => {
  const outcome = await saveNewList(formData);
  if ("error" in outcome) {
    return { error: outcome.error, values: readListFormValues(formData) };
  }

  redirect(outcome.redirectTo);
};

/** Edita una lista (`useActionState`): los errores de nombre vuelven al formulario. */
export const updateListWithFeedback = async (
  listId: string,
  _prev: ListFormState,
  formData: FormData,
): Promise<ListFormState> => {
  const outcome = await saveListChanges(listId, formData);
  if ("error" in outcome) {
    return { error: outcome.error, values: readListFormValues(formData) };
  }

  redirect(outcome.redirectTo);
};

export const deleteList = async (listId: string) => {
  const userId = await requireUserId();
  const existing = await requireOwnedList(listId, userId);

  if (isFixedListSlug(existing.slug)) {
    throw new Error("Las listas diarias no se pueden borrar.");
  }

  await db.delete(lists).where(eq(lists.id, listId));
  revalidateLists(listId);
};

export const addTitleToList = async (listId: string, titleId: string) => {
  const userId = await requireUserId();
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
  scheduleTonightRecompute(userId);
};

export const removeTitleFromList = async (listId: string, titleId: string) => {
  const userId = await requireUserId();
  const list = await requireOwnedList(listId, userId);

  await db
    .delete(listItems)
    .where(and(eq(listItems.listId, listId), eq(listItems.titleId, titleId)));
  revalidateLists(listId, titleId, list.slug);
  scheduleTonightRecompute(userId);
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
  scheduleTonightRecompute(userId);
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

export const reorderList = async (listId: string, orderedTitleIds: string[]) => {
  const userId = await requireUserId();
  const list = await requireOwnedList(listId, userId);
  const changed = await reorderListItems(listId, orderedTitleIds);
  if (changed) {
    revalidateLists(listId, undefined, list.slug);
  }
};
