import { slugify } from "@/lib/labels";
import { prisma } from "@/lib/prisma";

/**
 * Etiquetas sugeridas al gusto de Jorge (guerra/épica, visual Mad Max–Tron, etc.).
 * Se crean por usuario con ensureDefaultTags; no pisan nombres ya existentes.
 */
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

/**
 * Varios `?tag=` se combinan con OR: basta con que el título tenga
 * cualquiera de las etiquetas elegidas.
 */
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
  titleTags: Array<{ tag: { slug: string } }>,
  slugs: string[],
) => {
  if (slugs.length === 0) {
    return true;
  }

  const selected = new Set(slugs);
  return titleTags.some((item) => selected.has(item.tag.slug));
};

export const tagHref = (slug: string) => `/tags/${slug}`;

type CatalogQuery = {
  tags?: string[];
  view?: string | null;
  sort?: string | null;
};

export const catalogSearchParams = ({ tags = [], view, sort }: CatalogQuery) => {
  const params = new URLSearchParams();

  for (const slug of uniqueSlugs(tags)) {
    params.append("tag", slug);
  }

  if (view && view !== "deck") {
    params.set("view", view);
  }

  if (sort) {
    params.set("sort", sort);
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

      await prisma.tag.upsert({
        where: { userId_slug: { userId, slug } },
        update: {},
        create: { userId, name, slug },
      });
    }),
  );
};
