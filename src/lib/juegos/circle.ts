import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { db, juegoRetos, listMembers, lists, quinielaGroupMembers } from "@/db";

/**
 * The people `userId` already knows in Filmia: someone sharing a list with them (owner or member),
 * someone in one of their quiniela groups, or someone they played a duel with (either side). Only
 * these can be challenged by name; anyone else gets a link.
 */
export const connectedUserIds = async (userId: string): Promise<Set<string>> => {
  const myLists = db
    .select({ id: lists.id })
    .from(lists)
    .where(eq(lists.userId, userId))
    .union(db.select({ id: listMembers.listId }).from(listMembers).where(eq(listMembers.userId, userId)));
  const myGroups = db.select({ id: quinielaGroupMembers.groupId }).from(quinielaGroupMembers).where(eq(quinielaGroupMembers.userId, userId));
  const [owners, members, groupmates, sent, received] = await Promise.all([
    db.select({ id: lists.userId }).from(lists).where(inArray(lists.id, myLists)),
    db.select({ id: listMembers.userId }).from(listMembers).where(inArray(listMembers.listId, myLists)),
    db.select({ id: quinielaGroupMembers.userId }).from(quinielaGroupMembers).where(inArray(quinielaGroupMembers.groupId, myGroups)),
    db.select({ id: juegoRetos.toUserId }).from(juegoRetos).where(and(eq(juegoRetos.fromUserId, userId), isNotNull(juegoRetos.toUserId))),
    db.select({ id: juegoRetos.fromUserId }).from(juegoRetos).where(eq(juegoRetos.toUserId, userId)),
  ]);
  const ids = new Set<string>();
  for (const row of [...owners, ...members, ...groupmates, ...sent, ...received]) if (row.id && row.id !== userId) ids.add(row.id);
  return ids;
};

/**
 * The person plus the people they know: every table in Extras (day tables, liga, bingo, estrenos)
 * shows only this circle, never every account.
 */
export const circleOf = async (userId: string): Promise<Set<string>> => {
  const ids = await connectedUserIds(userId);
  ids.add(userId);
  return ids;
};
