"use server";

import { ListKind } from "@/generated/prisma/browser";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseRequiredName } from "@/lib/form-data";
import { slugify } from "@/lib/labels";
import { isFixedListSlug, isReservedListSlug, listHref } from "@/lib/lists";
import { type ListMoveDirection, swapAdjacentListItems } from "@/lib/list-order";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";

const revalidateLists = (listId?: string, titleId?: string) => {
  revalidatePath("/");
  revalidatePath("/listas");
  revalidatePath("/watchlist");
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
  const list = await prisma.list.findFirst({
    where: { id: listId, userId },
    select: { id: true, slug: true, kind: true, name: true },
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

  const list = await prisma.list.create({
    data: { userId, name, description, kind: ListKind.COLLECTION },
  });

  revalidateLists(list.id);
  redirect(`/listas/${list.id}`);
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

  await prisma.list.update({
    where: { id: listId },
    data: { name, description },
  });

  revalidateLists(listId);
  redirect(listHref(existing));
};

export const deleteList = async (listId: string) => {
  const userId = await requireUserId();
  const existing = await requireOwnedList(listId, userId);

  if (isFixedListSlug(existing.slug)) {
    throw new Error("Las listas diarias no se pueden borrar.");
  }

  await prisma.list.delete({ where: { id: listId } });
  revalidateLists(listId);
  redirect("/listas");
};

export const addTitleToList = async (listId: string, formData: FormData) => {
  const userId = await requireUserId();
  const titleId = String(formData.get("titleId") ?? "").trim();
  if (!titleId) {
    throw new Error("Elige un título para agregar.");
  }

  await requireOwnedList(listId, userId);

  const title = await prisma.title.findFirst({
    where: { id: titleId, userId },
    select: { id: true },
  });

  if (!title) {
    throw new Error("Título no encontrado.");
  }

  const last = await prisma.listItem.findFirst({
    where: { listId },
    orderBy: { position: "desc" },
  });

  await prisma.listItem.upsert({
    where: { listId_titleId: { listId, titleId } },
    update: {},
    create: {
      listId,
      titleId,
      position: (last?.position ?? -1) + 1,
    },
  });

  revalidateLists(listId, titleId);
};

export const removeTitleFromList = async (listId: string, titleId: string) => {
  const userId = await requireUserId();
  await requireOwnedList(listId, userId);

  await prisma.listItem.delete({
    where: { listId_titleId: { listId, titleId } },
  });
  revalidateLists(listId, titleId);
};

export const toggleTitleInList = async (listId: string, titleId: string) => {
  const userId = await requireUserId();
  await requireOwnedList(listId, userId);

  const title = await prisma.title.findFirst({
    where: { id: titleId, userId },
    select: { id: true },
  });

  if (!title) {
    throw new Error("Título no encontrado.");
  }

  const existing = await prisma.listItem.findUnique({
    where: { listId_titleId: { listId, titleId } },
  });

  if (existing) {
    await prisma.listItem.delete({
      where: { listId_titleId: { listId, titleId } },
    });
  } else {
    const last = await prisma.listItem.findFirst({
      where: { listId },
      orderBy: { position: "desc" },
    });

    await prisma.listItem.create({
      data: {
        listId,
        titleId,
        position: (last?.position ?? -1) + 1,
      },
    });
  }

  revalidateLists(listId, titleId);
};

export const moveListItem = async (
  listId: string,
  titleId: string,
  direction: ListMoveDirection,
) => {
  const userId = await requireUserId();
  await requireOwnedList(listId, userId);
  await swapAdjacentListItems(listId, titleId, direction);
  revalidateLists(listId, titleId);
};
