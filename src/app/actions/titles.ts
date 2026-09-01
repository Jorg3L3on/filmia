"use server";

import { ListKind } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  parseIdList,
  parseNewTags,
  parseOptionalDate,
  parsePlatform,
  parseRating,
  parseRequiredName,
  parseTitleKind,
  parseYear,
} from "@/lib/form-data";
import { slugify } from "@/lib/labels";
import { prisma } from "@/lib/prisma";

const revalidateCatalog = (titleId?: string) => {
  revalidatePath("/");
  revalidatePath("/listas");
  if (titleId) {
    revalidatePath(`/titulos/${titleId}`);
    revalidatePath(`/titulos/${titleId}/editar`);
  }
};

const syncTags = async (titleId: string, tagIds: string[], newTags: string[]) => {
  const created = await Promise.all(
    newTags.map(async (name) => {
      const slug = slugify(name) || `tag-${crypto.randomUUID().slice(0, 8)}`;
      return prisma.tag.upsert({
        where: { slug },
        update: {},
        create: { name, slug },
      });
    }),
  );

  const nextIds = [...new Set([...tagIds, ...created.map((tag) => tag.id)])];

  await prisma.titleTag.deleteMany({ where: { titleId } });
  if (nextIds.length === 0) {
    return;
  }

  await prisma.titleTag.createMany({
    data: nextIds.map((tagId) => ({ titleId, tagId })),
  });
};

const syncLists = async (titleId: string, listIds: string[]) => {
  await prisma.listItem.deleteMany({
    where: {
      titleId,
      list: { kind: ListKind.COLLECTION },
      listId: { notIn: listIds },
    },
  });

  for (const [index, listId] of listIds.entries()) {
    const list = await prisma.list.findUnique({
      where: { id: listId },
      select: { kind: true },
    });

    if (!list || list.kind !== ListKind.COLLECTION) {
      continue;
    }

    await prisma.listItem.upsert({
      where: { listId_titleId: { listId, titleId } },
      update: {},
      create: { listId, titleId, position: index },
    });
  }
};

const readTitleFields = (formData: FormData) => ({
  name: parseRequiredName(formData.get("name")),
  originalName: String(formData.get("originalName") ?? "").trim() || null,
  kind: parseTitleKind(formData.get("kind")),
  year: parseYear(formData.get("year")),
  rating: parseRating(formData.get("rating")),
  review: String(formData.get("review") ?? "").trim() || null,
  platform: parsePlatform(formData.get("platform")),
  watchedAt: parseOptionalDate(formData.get("watchedAt")),
  tagIds: parseIdList(formData, "tagIds"),
  newTags: parseNewTags(formData.get("newTags")),
  listIds: parseIdList(formData, "listIds"),
});

export const createTitle = async (formData: FormData) => {
  const fields = readTitleFields(formData);

  const title = await prisma.title.create({
    data: {
      name: fields.name,
      originalName: fields.originalName,
      kind: fields.kind,
      year: fields.year,
      rating: fields.rating,
      review: fields.review,
      platform: fields.platform,
      watchedAt: fields.watchedAt,
    },
  });

  await syncTags(title.id, fields.tagIds, fields.newTags);
  await syncLists(title.id, fields.listIds);
  revalidateCatalog(title.id);
  redirect(`/titulos/${title.id}`);
};

export const updateTitle = async (titleId: string, formData: FormData) => {
  const fields = readTitleFields(formData);

  await prisma.title.update({
    where: { id: titleId },
    data: {
      name: fields.name,
      originalName: fields.originalName,
      kind: fields.kind,
      year: fields.year,
      rating: fields.rating,
      review: fields.review,
      platform: fields.platform,
      watchedAt: fields.watchedAt,
    },
  });

  await syncTags(titleId, fields.tagIds, fields.newTags);
  await syncLists(titleId, fields.listIds);
  revalidateCatalog(titleId);
  redirect(`/titulos/${titleId}`);
};

export const deleteTitle = async (titleId: string) => {
  await prisma.title.delete({ where: { id: titleId } });
  revalidateCatalog(titleId);
  redirect("/");
};
