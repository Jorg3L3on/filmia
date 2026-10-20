import { and, asc, eq } from "drizzle-orm";
import { db, listItems } from "@/db";
import { planListReorder } from "@/lib/list-reorder";

// List items are addressed by (listId, catalogId) since FIL-I18.

export type ListMoveDirection = "up" | "down";

export const swapAdjacentListItems = async (
  listId: string,
  catalogId: string,
  direction: ListMoveDirection,
) => {
  const items = await db.query.listItems.findMany({
    where: eq(listItems.listId, listId),
    orderBy: [asc(listItems.position)],
  });

  const index = items.findIndex((item) => item.catalogId === catalogId);
  const swapIndex = direction === "up" ? index - 1 : index + 1;

  if (index < 0 || swapIndex < 0 || swapIndex >= items.length) {
    return false;
  }

  const current = items[index]!;
  const neighbor = items[swapIndex]!;

  await swapListItemPositionsAtomic(listId, current, neighbor);
  return true;
};

/** Rewrites the whole manual order (0..n-1) in one batch; only changed rows are written. */
export const reorderListItems = async (listId: string, orderedCatalogIds: readonly string[]) => {
  const current = await db.query.listItems.findMany({
    where: eq(listItems.listId, listId),
    columns: { catalogId: true, position: true },
  });
  const updates = planListReorder(
    current.map((item) => ({ id: item.catalogId, position: item.position })),
    orderedCatalogIds,
  );
  const [first, ...rest] = updates.map(({ id, position }) =>
    db
      .update(listItems)
      .set({ position })
      .where(and(eq(listItems.listId, listId), eq(listItems.catalogId, id))),
  );
  if (!first) {
    return false;
  }

  await db.batch([first, ...rest]);
  return true;
};

export const swapListItemPositions = async (
  listId: string,
  catalogId: string,
  neighborCatalogId: string,
) => {
  if (catalogId === neighborCatalogId) {
    return false;
  }

  const [current, neighbor] = await Promise.all([
    db.query.listItems.findFirst({
      where: and(eq(listItems.listId, listId), eq(listItems.catalogId, catalogId)),
    }),
    db.query.listItems.findFirst({
      where: and(eq(listItems.listId, listId), eq(listItems.catalogId, neighborCatalogId)),
    }),
  ]);

  if (!current || !neighbor) {
    return false;
  }

  await swapListItemPositionsAtomic(listId, current, neighbor);
  return true;
};

const swapListItemPositionsAtomic = async (
  listId: string,
  current: { catalogId: string; position: number },
  neighbor: { catalogId: string; position: number },
) => {
  await db.batch([
    db
      .update(listItems)
      .set({ position: neighbor.position })
      .where(and(eq(listItems.listId, listId), eq(listItems.catalogId, current.catalogId))),
    db
      .update(listItems)
      .set({ position: current.position })
      .where(and(eq(listItems.listId, listId), eq(listItems.catalogId, neighbor.catalogId))),
  ]);
};
