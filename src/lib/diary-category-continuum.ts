import type { DiaryCategory } from "@/lib/diary-picks";
import { diaryHref } from "@/lib/diary-picks";

export type CategoryNeighbor = {
  slug: string;
  name: string;
  /** Index into the destination deck when landing. */
  startIndex: "first" | "last";
};

export const categoryIndexBySlug = (
  categories: readonly Pick<DiaryCategory, "slug">[],
  slug: string,
) => categories.findIndex((category) => category.slug === slug);

export const resolveCategoryNeighbor = (
  categories: readonly Pick<DiaryCategory, "slug" | "name">[],
  activeSlug: string,
  direction: "prev" | "next",
): CategoryNeighbor | null => {
  if (categories.length === 0) {
    return null;
  }

  const index = categoryIndexBySlug(categories, activeSlug);
  if (index < 0) {
    return null;
  }

  if (direction === "next") {
    const next = categories[index + 1];
    if (!next) {
      return null;
    }
    return { slug: next.slug, name: next.name, startIndex: "first" };
  }

  const prev = categories[index - 1];
  if (!prev) {
    return null;
  }
  return { slug: prev.slug, name: prev.name, startIndex: "last" };
};

export const categoryHref = (slug: string) => diaryHref(slug);

export const coverflowStartIndex = (
  titlesLength: number,
  start: "first" | "last",
) => {
  if (titlesLength <= 0) {
    return 0;
  }
  return start === "last" ? titlesLength - 1 : 0;
};
