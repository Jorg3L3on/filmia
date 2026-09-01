import { Platform, TitleKind } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export const titleInclude = {
  tags: { include: { tag: true } },
  listItems: { include: { list: true } },
} as const;

export type TitleWithRelations = Awaited<
  ReturnType<typeof getTitleById>
>;

type TitleFilters = {
  q?: string;
  kind?: TitleKind | "ALL";
  platform?: Platform | "ALL";
  tag?: string;
  sort?: "recent" | "rating" | "name" | "year";
};

export const getTitles = async (filters: TitleFilters = {}) => {
  const { q, kind, platform, tag, sort = "recent" } = filters;

  return prisma.title.findMany({
    where: {
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { originalName: { contains: q, mode: "insensitive" } },
              { review: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(kind && kind !== "ALL" ? { kind } : {}),
      ...(platform && platform !== "ALL" ? { platform } : {}),
      ...(tag
        ? { tags: { some: { tag: { slug: tag } } } }
        : {}),
    },
    include: titleInclude,
    orderBy:
      sort === "rating"
        ? [{ rating: { sort: "desc", nulls: "last" } }, { name: "asc" }]
        : sort === "name"
          ? { name: "asc" }
          : sort === "year"
            ? [{ year: { sort: "desc", nulls: "last" } }, { name: "asc" }]
            : { updatedAt: "desc" },
  });
};

export const getTitleById = async (id: string) => {
  return prisma.title.findUnique({
    where: { id },
    include: titleInclude,
  });
};

export const getTags = async () => {
  return prisma.tag.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { titles: true } } },
  });
};

export const getLists = async () => {
  return prisma.list.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { items: true } },
      items: {
        orderBy: { position: "asc" },
        include: { title: { include: titleInclude } },
      },
    },
  });
};

export const getListById = async (id: string) => {
  return prisma.list.findUnique({
    where: { id },
    include: {
      items: {
        orderBy: { position: "asc" },
        include: { title: { include: titleInclude } },
      },
    },
  });
};

export const getTitleOptions = async () => {
  return prisma.title.findMany({
    select: { id: true, name: true, year: true },
    orderBy: { name: "asc" },
  });
};
