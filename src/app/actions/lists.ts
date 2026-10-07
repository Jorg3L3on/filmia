"use server";

import { createId } from "@paralleldrive/cuid2";
import { and, desc, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, listItems, lists, titles } from "@/db";
import {
  upsertTitleFromTmdbForUser,
  type AddTitleFromTmdbInput,
} from "@/lib/add-title-from-tmdb";
import { parseRequiredName } from "@/lib/form-data";
import { slugify } from "@/lib/labels";
import { isFixedListSlug, isReservedListSlug, listHref, WATCHLIST_SLUG } from "@/lib/lists";
import {
  type ListMoveDirection,
  reorderListItems,
  swapAdjacentListItems,
  swapListItemPositions,
} from "@/lib/list-order";
import { revalidateSearchAddSurfaces } from "@/lib/revalidate-surfaces";
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

export const createList = async (formData: FormData) => {
  const userId = await requireUserId();
  const name = parseRequiredName(formData.get("name"));
  const description = String(formData.get("description") ?? "").trim() || null;

  if (isReservedListSlug(slugify(name))) {
    throw new Error("Ese nombre está reservado para una lista diaria.");
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

export type SaveTmdbTitleInListsResult =
  | { ok: true; titleId: string; created: boolean }
  | { ok: false; error: string };

/**
 * Upserts a TMDB title for the user (no Quiero ver / Visto side effects) and
 * applies a list diff in one round trip. Idempotent: re-adding is a no-op
 * (`onConflictDoNothing`), removing a missing row does nothing.
 */
export const saveTmdbTitleInLists = async ({
  tmdb,
  add,
  remove = [],
}: {
  tmdb: AddTitleFromTmdbInput;
  add: string[];
  remove?: string[];
}): Promise<SaveTmdbTitleInListsResult> => {
  const userId = await requireUserId();
  const addIds = [...new Set(add)];
  const removeIds = [...new Set(remove)].filter((id) => !addIds.includes(id));
  const touchedIds = [...addIds, ...removeIds];

  try {
    const owned =
      touchedIds.length > 0
        ? await db.query.lists.findMany({
            where: and(eq(lists.userId, userId), inArray(lists.id, touchedIds)),
            columns: { id: true, slug: true },
          })
        : [];

    if (owned.length !== touchedIds.length) {
      return { ok: false, error: "Lista no encontrada." };
    }

    const upserted = await upsertTitleFromTmdbForUser(userId, {
      tmdbId: tmdb.tmdbId,
      kind: tmdb.kind,
      name: tmdb.name,
      originalName: tmdb.originalName,
      year: tmdb.year,
      posterPath: tmdb.posterPath,
    });

    if (!upserted.ok) {
      return upserted;
    }

    const { titleId } = upserted;

    if (addIds.length > 0) {
      const tails = await Promise.all(
        addIds.map((listId) =>
          db.query.listItems.findFirst({
            where: eq(listItems.listId, listId),
            orderBy: [desc(listItems.position)],
            columns: { position: true },
          }),
        ),
      );

      await db
        .insert(listItems)
        .values(
          addIds.map((listId, index) => ({
            listId,
            titleId,
            position: (tails[index]?.position ?? -1) + 1,
          })),
        )
        .onConflictDoNothing();
    }

    if (removeIds.length > 0) {
      await db
        .delete(listItems)
        .where(and(eq(listItems.titleId, titleId), inArray(listItems.listId, removeIds)));
    }

    for (const list of owned) {
      revalidateLists(list.id, titleId, list.slug);
    }
    revalidateSearchAddSurfaces(titleId, {
      watchlist: owned.some((list) => list.slug === WATCHLIST_SLUG),
    });
    scheduleTonightRecompute(userId);

    return { ok: true, titleId, created: upserted.created };
  } catch (caught) {
    return {
      ok: false,
      error: caught instanceof Error ? caught.message : "No se pudo guardar en la lista.",
    };
  }
};

/** «Agregar título» in a list: a TMDB hit becomes a Filmia title and lands on the list. */
export const addTitleFromTmdbToList = async (
  listId: string,
  tmdb: AddTitleFromTmdbInput,
) => saveTmdbTitleInLists({ tmdb, add: [listId] });
