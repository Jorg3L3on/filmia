import { createId } from "@paralleldrive/cuid2";
import { and, eq } from "drizzle-orm";
import { db, tags } from "@/db";
import { slugify } from "@/lib/labels";
import type { SeriesStatusFilter } from "@/lib/series";

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

export const MINE_PLATFORMS_PARAM = "minePlatforms";

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

type CatalogQuery = {
  tags?: string[];
  view?: string | null;
  sort?: string | null;
  minePlatforms?: boolean;
  seriesStatus?: SeriesStatusFilter | null;
  month?: string | null;
  day?: string | null;
};

export const catalogSearchParams = ({
  tags: tagSlugs = [],
  view,
  sort,
  minePlatforms,
  seriesStatus,
  month,
  day,
}: CatalogQuery) => {
  const params = new URLSearchParams();

  for (const slug of uniqueSlugs(tagSlugs)) {
    params.append("tag", slug);
  }

  if (view && view !== "deck") {
    params.set("view", view);
  }

  if (sort) {
    params.set("sort", sort);
  }

  if (minePlatforms) {
    params.set(MINE_PLATFORMS_PARAM, "1");
  }

  if (seriesStatus) {
    params.set("seriesStatus", seriesStatus);
  }

  if (view === "calendar" && month) {
    params.set("month", month);
  }

  if (view === "calendar" && day) {
    params.set("day", day);
  }

  return params;
};

export const catalogHref = (pathname: string, query: CatalogQuery = {}) => {
  const qs = catalogSearchParams(query).toString();
  return qs ? `${pathname}?${qs}` : pathname;
};

export const ensureDefaultTags = async (userId: string) => {
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
};
