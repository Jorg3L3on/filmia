"use server";

import { ListKind } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseRequiredName } from "@/lib/form-data";
import { prisma } from "@/lib/prisma";

const revalidateLists = (listId?: string) => {
  revalidatePath("/");
  revalidatePath("/listas");
  if (listId) {
    revalidatePath(`/listas/${listId}`);
    revalidatePath(`/listas/${listId}/editar`);
  }
};

export const createList = async (formData: FormData) => {
  const name = parseRequiredName(formData.get("name"));
  const description = String(formData.get("description") ?? "").trim() || null;

  const list = await prisma.list.create({
    data: { name, description, kind: ListKind.COLLECTION },
  });

  revalidateLists(list.id);
  redirect(`/listas/${list.id}`);
};

export const updateList = async (listId: string, formData: FormData) => {
  const name = parseRequiredName(formData.get("name"));
  const description = String(formData.get("description") ?? "").trim() || null;

  await prisma.list.update({
    where: { id: listId },
    data: { name, description },
  });

  revalidateLists(listId);
  redirect(`/listas/${listId}`);
};

export const deleteList = async (listId: string) => {
  await prisma.list.delete({ where: { id: listId } });
  revalidateLists(listId);
  redirect("/listas");
};

export const addTitleToList = async (listId: string, formData: FormData) => {
  const titleId = String(formData.get("titleId") ?? "").trim();
  if (!titleId) {
    throw new Error("Elige un título para agregar.");
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
  await prisma.listItem.delete({
    where: { listId_titleId: { listId, titleId } },
  });
  revalidateLists(listId);
};
