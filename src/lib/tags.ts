import { createId } from "@paralleldrive/cuid2";
import { cache } from "react";
import { db, tags } from "@/db";
import { slugify } from "@/lib/labels";

export {
  catalogHref,
  catalogSearchParams,
  MINE_PLATFORMS_PARAM,
  type CatalogKindFilter,
  type CatalogQuery,
} from "@/lib/catalog-href";

export const DEFAULT_TAG_NAMES = [
  "Épica / guerra",
  "Visual / espectáculo",
  "Histórico",
  "Sci-fi",
  "Vibe Mad Max",
  "Vibe Tron",
  "Thriller",
] as const;

export type CatalogSort = "recent" | "watched" | "rating" | "name" | "year";

export const TAG_SORT_OPTIONS = [
  { id: "rating", label: "Por nota" },
  { id: "watched", label: "Por fecha vista" },
  { id: "name", label: "Por nombre" },
  { id: "recent", label: "Recientes" },
] as const satisfies ReadonlyArray<{ id: CatalogSort; label: string }>;

export const isCatalogSort = (value: string | undefined): value is CatalogSort =>
  TAG_SORT_OPTIONS.some((option) => option.id === value) || value === "year";

export const parseTagSlugs = (value: unknown): string[] => {
  if (typeof value === "string") {
    return uniqueSlugs(value.split(","));
  }

  if (Array.isArray(value)) {
    return uniqueSlugs(
      value.flatMap((item) => (typeof item === "string" ? item.split(",") : [])),
    );
  }

  return [];
};

const uniqueSlugs = (values: string[]) => [
  ...new Set(values.map((value) => value.trim()).filter(Boolean)),
];

export const titleMatchesAnyTag = (
  titleTagsList: Array<{ tag: { slug: string } }>,
  slugs: string[],
) => {
  if (slugs.length === 0) {
    return true;
  }

  const selected = new Set(slugs);
  return titleTagsList.some((item) => selected.has(item.tag.slug));
};

export const tagHref = (slug: string) => `/tags/${slug}`;

/**
 * `?minePlatforms=1` (también `true` / `on`) activa “Solo en mis plataformas”.
 */
export const parseMinePlatforms = (value: unknown): boolean => {
  if (Array.isArray(value)) {
    return value.some((item) => parseMinePlatforms(item));
  }

  if (typeof value !== "string") {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "on";
};

export const ensureDefaultTags = cache(async (userId: string) => {
  await Promise.all(
    DEFAULT_TAG_NAMES.map(async (name) => {
      const slug = slugify(name);
      if (!slug) {
        return;
      }

      await db
        .insert(tags)
        .values({
          id: createId(),
          userId,
          name,
          slug,
        })
        .onConflictDoUpdate({
          target: [tags.userId, tags.slug],
          set: { name },
        });
    }),
  );
});
