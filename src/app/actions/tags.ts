"use server";

import { createId } from "@paralleldrive/cuid2";
import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db, tags, titleTags, titles } from "@/db";
import { parseRequiredName } from "@/lib/form-data";
import { slugify } from "@/lib/labels";
import { revalidateTagSurfaces } from "@/lib/revalidate-surfaces";
import { requireUserId } from "@/lib/session";
import { scheduleTonightRecompute } from "@/lib/tonight-store";
import { tagHref } from "@/lib/tags";

const revalidateTags = (titleId?: string, slug?: string) => {
  revalidateTagSurfaces(titleId, slug);
};

const upsertOwnedTag = async (userId: string, name: string) => {
  const slug = slugify(name) || `tag-${crypto.randomUUID().slice(0, 8)}`;

  const existing = await db.query.tags.findFirst({
    where: and(eq(tags.userId, userId), eq(tags.slug, slug)),
  });

  if (existing) {
    return existing;
  }

  const tagId = createId();
  await db.insert(tags).values({ id: tagId, userId, name, slug });

  return db.query.tags.findFirst({
    where: eq(tags.id, tagId),
  }).then((tag) => {
    if (!tag) {
      throw new Error("No se pudo crear la etiqueta.");
    }
    return tag;
  });
};

export const createTag = async (formData: FormData) => {
  const userId = await requireUserId();
  const name = parseRequiredName(formData.get("name"));
  const tag = await upsertOwnedTag(userId, name);

  revalidateTags(undefined, tag.slug);
  redirect(tagHref(tag.slug));
};

export const createAndAssignTag = async (titleId: string, formData: FormData) => {
  const userId = await requireUserId();
  const name = parseRequiredName(formData.get("name"));

  const title = await db.query.titles.findFirst({
    where: and(eq(titles.id, titleId), eq(titles.userId, userId)),
    columns: { id: true },
  });

  if (!title) {
    throw new Error("Título no encontrado.");
  }

  const tag = await upsertOwnedTag(userId, name);

  await db
    .insert(titleTags)
    .values({ titleId, tagId: tag.id })
    .onConflictDoNothing();

  revalidateTags(titleId, tag.slug);
};

/** Title links go with the tag via `onDelete: cascade`; titles themselves stay. */
export const deleteTag = async (tagId: string) => {
  const userId = await requireUserId();
  const tag = await db.query.tags.findFirst({
    where: and(eq(tags.id, tagId), eq(tags.userId, userId)),
    columns: { id: true, slug: true },
  });

  if (!tag) {
    throw new Error("Etiqueta no encontrada.");
  }

  await db.delete(tags).where(eq(tags.id, tag.id));
  revalidateTags(undefined, tag.slug);
};

export const removeTitleFromTag = async (tagId: string, titleId: string) => {
  const userId = await requireUserId();
  const tag = await db.query.tags.findFirst({
    where: and(eq(tags.id, tagId), eq(tags.userId, userId)),
    columns: { id: true, slug: true },
  });

  if (!tag) {
    throw new Error("Etiqueta no encontrada.");
  }

  await db
    .delete(titleTags)
    .where(and(eq(titleTags.tagId, tag.id), eq(titleTags.titleId, titleId)));
  revalidateTags(titleId, tag.slug);
};

export const addTitleToTag = async (tagId: string, titleId: string) => {
  const userId = await requireUserId();

  const [tag, title] = await Promise.all([
    db.query.tags.findFirst({
      where: and(eq(tags.id, tagId), eq(tags.userId, userId)),
      columns: { id: true, slug: true },
    }),
    db.query.titles.findFirst({
      where: and(eq(titles.id, titleId), eq(titles.userId, userId)),
      columns: { id: true },
    }),
  ]);

  if (!tag) {
    throw new Error("Etiqueta no encontrada.");
  }

  if (!title) {
    throw new Error("Título no encontrado.");
  }

  await db.insert(titleTags).values({ titleId, tagId: tag.id }).onConflictDoNothing();
  revalidateTags(titleId, tag.slug);
};

/** Returns the new slug so the client can move to the renamed tag's URL. */
export const renameTag = async (tagId: string, formData: FormData) => {
  const userId = await requireUserId();
  const name = parseRequiredName(formData.get("name"));
  const slug = slugify(name);
  if (!slug) {
    throw new Error("Usa letras o números en el nombre.");
  }

  const tag = await db.query.tags.findFirst({
    where: and(eq(tags.id, tagId), eq(tags.userId, userId)),
    columns: { id: true, slug: true },
  });

  if (!tag) {
    throw new Error("Etiqueta no encontrada.");
  }

  if (slug !== tag.slug) {
    const clash = await db.query.tags.findFirst({
      where: and(eq(tags.userId, userId), eq(tags.slug, slug)),
      columns: { id: true },
    });
    if (clash) {
      throw new Error("Ya tienes una etiqueta con ese nombre.");
    }
  }

  await db.update(tags).set({ name, slug }).where(eq(tags.id, tag.id));
  revalidateTags(undefined, tag.slug);
  revalidateTags(undefined, slug);
  return slug;
};

export const toggleTitleTag = async (tagId: string, titleId: string) => {
  const userId = await requireUserId();

  const [tag, title] = await Promise.all([
    db.query.tags.findFirst({
      where: and(eq(tags.id, tagId), eq(tags.userId, userId)),
      columns: { id: true, slug: true },
    }),
    db.query.titles.findFirst({
      where: and(eq(titles.id, titleId), eq(titles.userId, userId)),
      columns: { id: true },
    }),
  ]);

  if (!tag) {
    throw new Error("Etiqueta no encontrada.");
  }

  if (!title) {
    throw new Error("Título no encontrado.");
  }

  const existing = await db.query.titleTags.findFirst({
    where: and(eq(titleTags.titleId, titleId), eq(titleTags.tagId, tagId)),
  });

  if (existing) {
    await db
      .delete(titleTags)
      .where(and(eq(titleTags.titleId, titleId), eq(titleTags.tagId, tagId)));
  } else {
    await db.insert(titleTags).values({ titleId, tagId });
  }

  revalidateTags(titleId, tag.slug);
  scheduleTonightRecompute(userId);
};
