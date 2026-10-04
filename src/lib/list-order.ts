import { and, asc, eq } from "drizzle-orm";
import { db, listItems } from "@/db";
import { planListReorder } from "@/lib/list-reorder";

export type ListMoveDirection = "up" | "down";

export const swapAdjacentListItems = async (
  listId: string,
  titleId: string,
  direction: ListMoveDirection,
) => {
  const items = await db.query.listItems.findMany({
    where: eq(listItems.listId, listId),
    orderBy: [asc(listItems.position)],
  });

  const index = items.findIndex((item) => item.titleId === titleId);
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
export const reorderListItems = async (listId: string, orderedTitleIds: readonly string[]) => {
  const current = await db.query.listItems.findMany({
    where: eq(listItems.listId, listId),
    columns: { titleId: true, position: true },
  });
  const updates = planListReorder(current, orderedTitleIds);
  const [first, ...rest] = updates.map(({ titleId, position }) =>
    db
      .update(listItems)
      .set({ position })
      .where(and(eq(listItems.listId, listId), eq(listItems.titleId, titleId))),
  );
  if (!first) {
    return false;
  }

  await db.batch([first, ...rest]);
  return true;
};

export const swapListItemPositions = async (
  listId: string,
  titleId: string,
  neighborTitleId: string,
) => {
  if (titleId === neighborTitleId) {
    return false;
  }

  const [current, neighbor] = await Promise.all([
    db.query.listItems.findFirst({
      where: and(eq(listItems.listId, listId), eq(listItems.titleId, titleId)),
    }),
    db.query.listItems.findFirst({
      where: and(eq(listItems.listId, listId), eq(listItems.titleId, neighborTitleId)),
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
  current: { titleId: string; position: number },
  neighbor: { titleId: string; position: number },
) => {
  await db.batch([
    db
      .update(listItems)
      .set({ position: neighbor.position })
      .where(
        and(eq(listItems.listId, listId), eq(listItems.titleId, current.titleId)),
      ),
    db
      .update(listItems)
      .set({ position: current.position })
      .where(
        and(eq(listItems.listId, listId), eq(listItems.titleId, neighbor.titleId)),
      ),
  ]);
};
