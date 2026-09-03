"use server";

import { ListKind } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseRequiredName } from "@/lib/form-data";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";

const revalidateLists = (listId?: string) => {
  revalidatePath("/");
  revalidatePath("/listas");
  if (listId) {
    revalidatePath(`/listas/${listId}`);
    revalidatePath(`/listas/${listId}/editar`);
  }
};

export const createList = async (formData: FormData) => {
  const userId = await requireUserId();
  const name = parseRequiredName(formData.get("name"));
  const description = String(formData.get("description") ?? "").trim() || null;

  const list = await prisma.list.create({
    data: { userId, name, description, kind: ListKind.COLLECTION },
  });

  revalidateLists(list.id);
  redirect(`/listas/${list.id}`);
};

export const updateList = async (listId: string, formData: FormData) => {
  const userId = await requireUserId();
  const name = parseRequiredName(formData.get("name"));
  const description = String(formData.get("description") ?? "").trim() || null;

  const existing = await prisma.list.findFirst({
    where: { id: listId, userId },
    select: { id: true },
  });

  if (!existing) {
    throw new Error("Lista no encontrada.");
  }

  await prisma.list.update({
    where: { id: listId },
    data: { name, description },
  });

  revalidateLists(listId);
  redirect(`/listas/${listId}`);
};

export const deleteList = async (listId: string) => {
  const userId = await requireUserId();

  const existing = await prisma.list.findFirst({
    where: { id: listId, userId },
    select: { id: true },
  });

  if (!existing) {
    throw new Error("Lista no encontrada.");
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

  const list = await prisma.list.findFirst({
    where: { id: listId, userId },
    select: { id: true },
  });

  if (!list) {
    throw new Error("Lista no encontrada.");
  }

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

  revalidateLists(listId);
};

export const removeTitleFromList = async (listId: string, titleId: string) => {
  const userId = await requireUserId();

  const list = await prisma.list.findFirst({
    where: { id: listId, userId },
    select: { id: true },
  });

  if (!list) {
    throw new Error("Lista no encontrada.");
  }

  await prisma.listItem.delete({
    where: { listId_titleId: { listId, titleId } },
  });
  revalidateLists(listId);
};
