"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseRequiredName } from "@/lib/form-data";
import { slugify } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { tagHref } from "@/lib/tags";

const revalidateTags = (titleId?: string, slug?: string) => {
  revalidatePath("/");
  revalidatePath("/listas");
  revalidatePath("/listas", "layout");
  revalidatePath("/watchlist");
  revalidatePath("/tags");
  revalidatePath("/tags", "layout");
  if (slug) {
    revalidatePath(tagHref(slug));
  }
  if (titleId) {
    revalidatePath(`/titulos/${titleId}`);
    revalidatePath(`/titulos/${titleId}/editar`);
  }
};

const upsertOwnedTag = async (userId: string, name: string) => {
  const slug = slugify(name) || `tag-${crypto.randomUUID().slice(0, 8)}`;

  const tag = await prisma.tag.upsert({
    where: { userId_slug: { userId, slug } },
    update: {},
    create: { userId, name, slug },
  });

  return tag;
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

  const title = await prisma.title.findFirst({
    where: { id: titleId, userId },
    select: { id: true },
  });

  if (!title) {
    throw new Error("Título no encontrado.");
  }

  const tag = await upsertOwnedTag(userId, name);

  await prisma.titleTag.upsert({
    where: { titleId_tagId: { titleId, tagId: tag.id } },
    update: {},
    create: { titleId, tagId: tag.id },
  });

  revalidateTags(titleId, tag.slug);
};

export const toggleTitleTag = async (tagId: string, titleId: string) => {
  const userId = await requireUserId();

  const [tag, title] = await Promise.all([
    prisma.tag.findFirst({
      where: { id: tagId, userId },
      select: { id: true, slug: true },
    }),
    prisma.title.findFirst({
      where: { id: titleId, userId },
      select: { id: true },
    }),
  ]);

  if (!tag) {
    throw new Error("Etiqueta no encontrada.");
  }

  if (!title) {
    throw new Error("Título no encontrado.");
  }

  const existing = await prisma.titleTag.findUnique({
    where: { titleId_tagId: { titleId, tagId } },
  });

  if (existing) {
    await prisma.titleTag.delete({
      where: { titleId_tagId: { titleId, tagId } },
    });
  } else {
    await prisma.titleTag.create({
      data: { titleId, tagId },
    });
  }

  revalidateTags(titleId, tag.slug);
};
