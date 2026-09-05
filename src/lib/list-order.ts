import { prisma } from "@/lib/prisma";

export type ListMoveDirection = "up" | "down";

export const swapAdjacentListItems = async (
  listId: string,
  titleId: string,
  direction: ListMoveDirection,
) => {
  const items = await prisma.listItem.findMany({
    where: { listId },
    orderBy: { position: "asc" },
  });

  const index = items.findIndex((item) => item.titleId === titleId);
  const swapIndex = direction === "up" ? index - 1 : index + 1;

  if (index < 0 || swapIndex < 0 || swapIndex >= items.length) {
    return false;
  }

  const current = items[index];
  const neighbor = items[swapIndex];

  await prisma.$transaction([
    prisma.listItem.update({
      where: {
        listId_titleId: { listId, titleId: current.titleId },
      },
      data: { position: neighbor.position },
    }),
    prisma.listItem.update({
      where: {
        listId_titleId: { listId, titleId: neighbor.titleId },
      },
      data: { position: current.position },
    }),
  ]);

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
    prisma.listItem.findUnique({
      where: { listId_titleId: { listId, titleId } },
    }),
    prisma.listItem.findUnique({
      where: { listId_titleId: { listId, titleId: neighborTitleId } },
    }),
  ]);

  if (!current || !neighbor) {
    return false;
  }

  await prisma.$transaction([
    prisma.listItem.update({
      where: { listId_titleId: { listId, titleId: current.titleId } },
      data: { position: neighbor.position },
    }),
    prisma.listItem.update({
      where: { listId_titleId: { listId, titleId: neighbor.titleId } },
      data: { position: current.position },
    }),
  ]);

  return true;
};
