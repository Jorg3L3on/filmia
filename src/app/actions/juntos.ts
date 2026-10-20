"use server";

import { and, desc, eq, isNotNull, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { catalog, db, listItems } from "@/db";
import { getListPeople } from "@/lib/list-invites";
import { requireListAccess } from "@/lib/list-access";
import { canWatchTogether } from "@/lib/group-access";

/**
 * FIL-I19-3 · the two actions of «Qué vemos juntos». Owner and editors only
 * (`edit_items`), on lists where the group view exists. Suggestions never go
 * into the list by themselves: one of these runs only when someone taps it.
 */

const requireTogether = async (listId: string) => {
  const access = await requireListAccess(listId, "edit_items");
  const people = await getListPeople(listId);
  if (!canWatchTogether(access.list, access.role, people)) {
    throw new Error("Esta lista no tiene «Qué vemos juntos».");
  }
  return access;
};

const ensureInList = async (listId: string, catalogId: string, userId: string) => {
  const film = await db.query.catalog.findFirst({ where: eq(catalog.id, catalogId), columns: { id: true } });
  if (!film) {
    throw new Error("Título no encontrado.");
  }
  const last = await db.query.listItems.findFirst({
    where: eq(listItems.listId, listId),
    orderBy: [desc(listItems.position)],
  });
  await db
    .insert(listItems)
    .values({ listId, catalogId, addedByUserId: userId, position: (last?.position ?? -1) + 1 })
    .onConflictDoNothing();
};

const revalidateTogether = (listId: string) => {
  revalidatePath(`/listas/${listId}`);
  revalidatePath(`/listas/${listId}/juntos`);
  revalidatePath("/listas");
};

/** «A la lista»: a new suggestion joins the list, added by whoever tapped it. */
export const addSuggestionToList = async (listId: string, catalogId: string) => {
  const { userId } = await requireTogether(listId);
  await ensureInList(listId, catalogId, userId);
  revalidateTogether(listId);
};

/**
 * «Vamos con esta»: marks the film as the group's pick on this list, and only
 * that (pinned decision): no alert, nobody's Hoy changes. A new suggestion is
 * added first. One pick per list: the previous one is cleared.
 */
export const chooseTonight = async (listId: string, catalogId: string) => {
  const { userId } = await requireTogether(listId);
  await ensureInList(listId, catalogId, userId);
  await db.batch([
    db
      .update(listItems)
      .set({ chosenAt: null, chosenByUserId: null })
      .where(and(eq(listItems.listId, listId), isNotNull(listItems.chosenAt), ne(listItems.catalogId, catalogId))),
    db
      .update(listItems)
      .set({ chosenAt: new Date(), chosenByUserId: userId })
      .where(and(eq(listItems.listId, listId), eq(listItems.catalogId, catalogId))),
  ]);
  revalidateTogether(listId);
};

/** Undo the pick («Ya no»). */
export const clearTonight = async (listId: string) => {
  await requireListAccess(listId, "edit_items");
  await db
    .update(listItems)
    .set({ chosenAt: null, chosenByUserId: null })
    .where(and(eq(listItems.listId, listId), isNotNull(listItems.chosenAt)));
  revalidateTogether(listId);
};
