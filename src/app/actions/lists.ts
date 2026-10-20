"use server";

import { and, desc, eq, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db, listItems, lists } from "@/db";
import {
  upsertTitleFromTmdbForUser,
  type AddTitleFromTmdbInput,
} from "@/lib/add-title-from-tmdb";
import { canOnList } from "@/lib/list-access-core";
import { LIST_NOT_FOUND, listAccessFor, requireListAccess } from "@/lib/list-access";
import { catalogIdOfOwnTitle } from "@/lib/list-items";
import { type ListFormState } from "@/lib/list-names";
import {
  isFixedListSlug,
  isSeriesStatusListSlug,
  listHref,
  WATCHLIST_SLUG,
} from "@/lib/lists";
import {
  type ListMoveDirection,
  reorderListItems,
  swapAdjacentListItems,
  swapListItemPositions,
} from "@/lib/list-order";
import { revalidateSearchAddSurfaces } from "@/lib/revalidate-surfaces";
import { requireUserId } from "@/lib/session";
import { scheduleTonightRecompute } from "@/lib/tonight-store";
import { isDomainError } from "@/lib/domain-error";
import {
  addTitleToListFor,
  createListFor,
  parseListName,
  removeFromListFor,
  resolveListItemCatalogIds,
  revalidateLists,
  userListNameError,
  YEAR_TOP_FROM_CINE,
} from "@/lib/list-writes";

/** Tu top 10 del año only takes films of that year you saw, through `saveYearTop`. */

type ListSaveOutcome = { error: string } | { redirectTo: string };

const readListFormValues = (formData: FormData) => ({
  name: String(formData.get("name") ?? ""),
  description: String(formData.get("description") ?? ""),
});

const saveNewList = async (formData: FormData): Promise<ListSaveOutcome> => {
  const userId = await requireUserId();
  try {
    const { listId } = await createListFor(userId, {
      name: String(formData.get("name") ?? ""),
      description: String(formData.get("description") ?? ""),
    });
    return { redirectTo: `/listas/${listId}` };
  } catch (error) {
    if (isDomainError(error)) return { error: error.message };
    throw error;
  }
};

const saveListChanges = async (
  listId: string,
  formData: FormData,
): Promise<ListSaveOutcome> => {
  const { userId, list: existing } = await requireListAccess(listId, "manage");
  const description = String(formData.get("description") ?? "").trim() || null;
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
  const { list: existing } = await requireListAccess(listId, "manage");

  if (isFixedListSlug(existing.slug)) {
    throw new Error("Las listas diarias no se pueden borrar.");
  }

  await db.delete(lists).where(eq(lists.id, listId));
  revalidateLists(listId);
};

export const addTitleToList = async (listId: string, titleId: string) => {
  if (!titleId) {
    throw new Error("Elige un título para agregar.");
  }
  await addTitleToListFor(await requireUserId(), listId, titleId);
};

/** `titleId`: your own title, or the catalog id of a film someone else added. */
export const removeTitleFromList = async (listId: string, titleId: string) => {
  await removeFromListFor(await requireUserId(), listId, titleId);
};

export const toggleTitleInList = async (listId: string, titleId: string) => {
  const { userId, list } = await requireListAccess(listId, "edit_items");

  if (isSeriesStatusListSlug(list.slug)) {
    throw new Error("Esta lista se actualiza sola con el estado de la serie.");
  }

  const catalogId = await catalogIdOfOwnTitle(userId, titleId);
  if (!catalogId) {
    throw new Error("Título no encontrado.");
  }

  const existing = await db.query.listItems.findFirst({
    where: and(eq(listItems.listId, listId), eq(listItems.catalogId, catalogId)),
  });

  if (existing) {
    await db
      .delete(listItems)
      .where(and(eq(listItems.listId, listId), eq(listItems.catalogId, catalogId)));
  } else {
    if (list.kind === "YEAR_TOP") {
      throw new Error(YEAR_TOP_FROM_CINE);
    }
    const last = await db.query.listItems.findFirst({
      where: eq(listItems.listId, listId),
      orderBy: [desc(listItems.position)],
    });

    await db.insert(listItems).values({
      listId,
      catalogId,
      addedByUserId: userId,
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
  const { userId, list } = await requireListAccess(listId, "edit_items");
  const catalogIds = await resolveListItemCatalogIds(
    userId,
    listId,
    neighborTitleId ? [titleId, neighborTitleId] : [titleId],
  );
  const catalogId = catalogIds.get(titleId);
  const neighborCatalogId = neighborTitleId ? catalogIds.get(neighborTitleId) : undefined;
  if (!catalogId) {
    return;
  }
  if (neighborCatalogId) {
    await swapListItemPositions(listId, catalogId, neighborCatalogId);
  } else {
    await swapAdjacentListItems(listId, catalogId, direction);
  }
  revalidateLists(listId, titleId, list.slug);
};

export const reorderList = async (listId: string, orderedTitleIds: string[]) => {
  const { userId, list } = await requireListAccess(listId, "edit_items");
  const catalogIds = await resolveListItemCatalogIds(userId, listId, orderedTitleIds);
  const changed = await reorderListItems(
    listId,
    orderedTitleIds.flatMap((titleId) => catalogIds.get(titleId) ?? []),
  );
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
    // Your lists and the shared ones where you are an editor.
    const accesses = await Promise.all(touchedIds.map((id) => listAccessFor(id, userId)));
    if (accesses.some((access) => !access || !canOnList(access.role, "edit_items"))) {
      return { ok: false, error: LIST_NOT_FOUND };
    }
    const owned = accesses.flatMap((access) => (access ? [access.list] : []));

    if (owned.some((list) => list.kind === "YEAR_TOP" && addIds.includes(list.id))) {
      return { ok: false, error: YEAR_TOP_FROM_CINE };
    }

    if (owned.some((list) => isSeriesStatusListSlug(list.slug))) {
      return { ok: false, error: "Esta lista se actualiza sola con el estado de la serie." };
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
    const catalogId = await catalogIdOfOwnTitle(userId, titleId);
    if (!catalogId) {
      return { ok: false, error: "Título no encontrado." };
    }

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
            catalogId,
            addedByUserId: userId,
            position: (tails[index]?.position ?? -1) + 1,
          })),
        )
        .onConflictDoNothing();
    }

    if (removeIds.length > 0) {
      await db
        .delete(listItems)
        .where(and(eq(listItems.catalogId, catalogId), inArray(listItems.listId, removeIds)));
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
