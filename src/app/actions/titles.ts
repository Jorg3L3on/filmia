"use server";

import { ListKind } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  parseIdList,
  parseNewTags,
  parseOptionalDate,
  parseOptionalReview,
  parsePlatform,
  parseRating,
  parseRequiredName,
  parseTitleKind,
  parseYear,
} from "@/lib/form-data";
import {
  upsertTitleFromTmdbForUser,
  type AddTitleFromTmdbInput,
  type AddTitleFromTmdbResult,
} from "@/lib/add-title-from-tmdb";
import { slugify } from "@/lib/labels";
import {
  enrichMetadataOnSave,
  readMetadataFields,
} from "@/lib/metadata";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { enrichWatchProvidersOnSave } from "@/lib/watch-providers-cache";

export type { AddTitleFromTmdbInput, AddTitleFromTmdbResult };

const revalidateCatalog = (titleId?: string) => {
  revalidatePath("/");
  revalidatePath("/listas");
  revalidatePath("/buscar");
  revalidatePath("/tags");
  if (titleId) {
    revalidatePath(`/titulos/${titleId}`);
    revalidatePath(`/titulos/${titleId}/editar`);
  }
};

const syncTags = async (userId: string, titleId: string, tagIds: string[], newTags: string[]) => {
  const created = await Promise.all(
    newTags.map(async (name) => {
      const slug = slugify(name) || `tag-${crypto.randomUUID().slice(0, 8)}`;
      return prisma.tag.upsert({
        where: { userId_slug: { userId, slug } },
        update: { name },
        create: { userId, name, slug },
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

const syncLists = async (userId: string, titleId: string, listIds: string[]) => {
  await prisma.listItem.deleteMany({
    where: {
      titleId,
      list: { userId, kind: ListKind.COLLECTION },
      listId: { notIn: listIds },
    },
  });

  for (const [index, listId] of listIds.entries()) {
    const list = await prisma.list.findFirst({
      where: { id: listId, userId },
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
  review: parseOptionalReview(formData.get("review")),
  platform: parsePlatform(formData.get("platform")),
  watchedAt: parseOptionalDate(formData.get("watchedAt")),
  tagIds: parseIdList(formData, "tagIds"),
  newTags: parseNewTags(formData.get("newTags")),
  listIds: parseIdList(formData, "listIds"),
});

export const addTitleFromTmdb = async (
  input: AddTitleFromTmdbInput,
): Promise<AddTitleFromTmdbResult> => {
  const userId = await requireUserId();
  const result = await upsertTitleFromTmdbForUser(userId, input);

  if (result.ok) {
    revalidateCatalog(result.titleId);
    revalidatePath("/watchlist");
  }

  return result;
};

export const createTitle = async (formData: FormData) => {
  const userId = await requireUserId();
  const fields = readTitleFields(formData);
  const metadata = await enrichMetadataOnSave(
    readMetadataFields(formData),
    fields.kind,
  );

  const title = await prisma.title.create({
    data: {
      userId,
      name: fields.name,
      originalName: fields.originalName,
      kind: fields.kind,
      year: fields.year,
      rating: fields.rating,
      review: fields.review,
      platform: fields.platform,
      watchedAt: fields.watchedAt,
      tmdbId: metadata.tmdbId,
      posterPath: metadata.posterPath,
      imdbId: metadata.imdbId,
      imdbRating: metadata.imdbRating,
    },
  });

  await syncTags(userId, title.id, fields.tagIds, fields.newTags);
  await syncLists(userId, title.id, fields.listIds);
  if (metadata.tmdbId) {
    await enrichWatchProvidersOnSave(title.id, metadata.tmdbId, fields.kind);
  }
  revalidateCatalog(title.id);
  redirect(`/titulos/${title.id}`);
};

export const updateTitle = async (titleId: string, formData: FormData) => {
  const userId = await requireUserId();
  const fields = readTitleFields(formData);
  const metadata = await enrichMetadataOnSave(
    readMetadataFields(formData),
    fields.kind,
  );

  const existing = await prisma.title.findFirst({
    where: { id: titleId, userId },
    select: { id: true },
  });

  if (!existing) {
    throw new Error("Título no encontrado.");
  }

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
      tmdbId: metadata.tmdbId,
      posterPath: metadata.posterPath,
      imdbId: metadata.imdbId,
      imdbRating: metadata.imdbRating,
    },
  });

  await syncTags(userId, titleId, fields.tagIds, fields.newTags);
  await syncLists(userId, titleId, fields.listIds);
  if (metadata.tmdbId) {
    await enrichWatchProvidersOnSave(titleId, metadata.tmdbId, fields.kind);
  }
  revalidateCatalog(titleId);
  redirect(`/titulos/${titleId}`);
};

export const deleteTitle = async (titleId: string) => {
  const userId = await requireUserId();

  const existing = await prisma.title.findFirst({
    where: { id: titleId, userId },
    select: { id: true },
  });

  if (!existing) {
    throw new Error("Título no encontrado.");
  }

  await prisma.title.delete({ where: { id: titleId } });
  revalidateCatalog(titleId);
  redirect("/");
};
