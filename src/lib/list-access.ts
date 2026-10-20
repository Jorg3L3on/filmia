import { and, eq } from "drizzle-orm";
import { cache } from "react";
import { db, listMembers, lists, type List } from "@/db";
import { canOnList, type ListAccessRole, type ListAction } from "@/lib/list-access-core";
import { requireUserId } from "@/lib/session";

export type ListAccess = { list: List; role: ListAccessRole; userId: string };

/**
 * The one place that decides who reaches a list (FIL-I18-2): the owner
 * (`List.userId`) or a member. Null for everyone else, including lists that
 * do not exist: callers answer both the same way, so a valid id from someone
 * else's list confirms nothing.
 */
export const listAccessFor = cache(
  async (listId: string, userId: string): Promise<ListAccess | null> => {
    const [row] = await db
      .select({ list: lists, memberRole: listMembers.role })
      .from(lists)
      .leftJoin(listMembers, and(eq(listMembers.listId, lists.id), eq(listMembers.userId, userId)))
      .where(eq(lists.id, listId))
      .limit(1);
    if (!row) {
      return null;
    }
    if (row.list.userId === userId) {
      return { list: row.list, role: "OWNER", userId };
    }
    return row.memberRole ? { list: row.list, role: row.memberRole, userId } : null;
  },
);

export const LIST_NOT_FOUND = "Lista no encontrada.";
export const LIST_FORBIDDEN = "No puedes cambiar esta lista.";

/**
 * For server actions: the signed-in user's access to the list, or an error.
 * Not reaching the list reads exactly like a list that does not exist; a
 * member below the needed role gets a plain «no puedes».
 */
export const requireListAccess = async (listId: string, action: ListAction): Promise<ListAccess> => {
  const userId = await requireUserId();
  const access = await listAccessFor(listId, userId);
  if (!access) {
    throw new Error(LIST_NOT_FOUND);
  }
  if (!canOnList(access.role, action)) {
    throw new Error(LIST_FORBIDDEN);
  }
  return access;
};

/** For pages: the access, or null (the page answers `notFound()`). */
export const getListAccess = async (listId: string): Promise<ListAccess | null> => {
  const userId = await requireUserId();
  return listAccessFor(listId, userId);
};
