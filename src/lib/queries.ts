import { ListKind, Platform, TitleKind } from "@/generated/prisma/browser";
import { sortUserLists } from "@/lib/lists";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { seriesStatusWhere, type SeriesStatusFilter } from "@/lib/series";
import { parseStoredStreamingPlatforms } from "@/lib/streaming-platforms";
import { WATCHLIST_SLUG } from "@/lib/watchlist";

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
  tags?: string[];
  sort?: "recent" | "watched" | "rating" | "name" | "year";
  onlyWatched?: boolean;
  seriesStatus?: SeriesStatusFilter;
};

export const getTitles = async (filters: TitleFilters = {}) => {
  const userId = await requireUserId();
  const {
    q,
    kind,
    platform,
    tags,
    sort = "recent",
    onlyWatched = false,
    seriesStatus,
  } = filters;
  const tagSlugs = [...new Set((tags ?? []).map((slug) => slug.trim()).filter(Boolean))];

  return prisma.title.findMany({
    where: {
      userId,
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
      // Varios slugs: OR (el título tiene cualquiera de las etiquetas).
      ...(tagSlugs.length > 0
        ? { tags: { some: { tag: { slug: { in: tagSlugs }, userId } } } }
        : {}),
      ...(onlyWatched ? { watchedAt: { not: null } } : {}),
      ...seriesStatusWhere(seriesStatus),
    },
    include: titleInclude,
    orderBy:
      sort === "rating"
        ? [{ rating: { sort: "desc", nulls: "last" } }, { name: "asc" }]
        : sort === "name"
          ? { name: "asc" }
          : sort === "year"
            ? [{ year: { sort: "desc", nulls: "last" } }, { name: "asc" }]
            : sort === "watched"
              ? [{ watchedAt: { sort: "desc", nulls: "last" } }, { name: "asc" }]
              : { updatedAt: "desc" },
  });
};

export const getTitleById = async (id: string) => {
  const userId = await requireUserId();

  return prisma.title.findFirst({
    where: { id, userId },
    include: titleInclude,
  });
};

export const getRelatedTitles = async (titleId: string, tagIds: string[]) => {
  if (tagIds.length === 0) {
    return [];
  }

  const userId = await requireUserId();

  return prisma.title.findMany({
    where: {
      userId,
      id: { not: titleId },
      tags: { some: { tagId: { in: tagIds } } },
    },
    include: titleInclude,
    orderBy: [{ watchedAt: { sort: "desc", nulls: "last" } }, { name: "asc" }],
    take: 12,
  });
};

export const getTags = async () => {
  const userId = await requireUserId();

  return prisma.tag.findMany({
    where: { userId },
    orderBy: { name: "asc" },
    include: { _count: { select: { titles: true } } },
  });
};

export const getTagBySlug = async (slug: string) => {
  const userId = await requireUserId();

  return prisma.tag.findUnique({
    where: { userId_slug: { userId, slug } },
    include: { _count: { select: { titles: true } } },
  });
};

const listIndexInclude = {
  _count: { select: { items: true } },
  items: {
    orderBy: { position: "asc" as const },
    take: 5,
    include: {
      title: { select: { id: true, name: true, posterPath: true } },
    },
  },
};

export const getLists = async () => {
  const userId = await requireUserId();

  const lists = await prisma.list.findMany({
    where: { userId },
    include: listIndexInclude,
  });

  return sortUserLists(lists);
};

export const getWatchlist = async () => {
  const userId = await requireUserId();

  const list = await prisma.list.findUnique({
    where: { userId_slug: { userId, slug: WATCHLIST_SLUG } },
    include: {
      items: {
        orderBy: { position: "asc" },
        include: { title: { include: titleInclude } },
      },
    },
  });

  if (!list) {
    return null;
  }

  return list;
};

export const getWatchlistCount = async () => {
  const userId = await requireUserId();

  const list = await prisma.list.findUnique({
    where: { userId_slug: { userId, slug: WATCHLIST_SLUG } },
    select: { _count: { select: { items: true } } },
  });

  return list?._count.items ?? 0;
};

export const isTitleInWatchlist = async (titleId: string) => {
  const userId = await requireUserId();

  const list = await prisma.list.findUnique({
    where: { userId_slug: { userId, slug: WATCHLIST_SLUG } },
    select: { id: true },
  });

  if (!list) {
    return false;
  }

  const item = await prisma.listItem.findUnique({
    where: { listId_titleId: { listId: list.id, titleId } },
  });

  return Boolean(item);
};

export const getCollectionLists = async () => {
  const userId = await requireUserId();

  const lists = await prisma.list.findMany({
    where: { userId, kind: ListKind.COLLECTION },
    select: { id: true, name: true, slug: true },
  });

  return sortUserLists(lists);
};

export const getAssignableLists = async () => {
  const userId = await requireUserId();

  const lists = await prisma.list.findMany({
    where: { userId },
    select: { id: true, name: true, slug: true, kind: true },
  });

  return sortUserLists(lists);
};

export const getListById = async (id: string) => {
  const userId = await requireUserId();

  return prisma.list.findFirst({
    where: { id, userId },
    include: {
      items: {
        orderBy: { position: "asc" },
        include: { title: { include: titleInclude } },
      },
    },
  });
};

export const getTitleOptions = async () => {
  const userId = await requireUserId();

  return prisma.title.findMany({
    where: { userId },
    select: { id: true, name: true, year: true },
    orderBy: { name: "asc" },
  });
};

export const getUserStreamingPlatforms = async () => {
  const userId = await requireUserId();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { streamingPlatforms: true },
  });

  return parseStoredStreamingPlatforms(user?.streamingPlatforms);
};

export const getCurrentUserProfile = async () => {
  const userId = await requireUserId();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      streamingPlatforms: true,
      createdAt: true,
    },
  });

  if (!user) {
    return null;
  }

  return {
    ...user,
    streamingPlatforms: parseStoredStreamingPlatforms(user.streamingPlatforms),
  };
};

export type UserTmdbEntry = {
  titleId: string;
  tmdbId: number;
  kind: TitleKind;
  inWatchlist: boolean;
  watched: boolean;
};

export const getUserTmdbIndex = async (): Promise<UserTmdbEntry[]> => {
  const userId = await requireUserId();

  const titles = await prisma.title.findMany({
    where: { userId, tmdbId: { not: null } },
    select: {
      id: true,
      tmdbId: true,
      kind: true,
      watchedAt: true,
      listItems: {
        where: { list: { slug: WATCHLIST_SLUG } },
        select: { listId: true },
      },
    },
  });

  return titles.flatMap((title) => {
    if (title.tmdbId == null) {
      return [];
    }

    return [
      {
        titleId: title.id,
        tmdbId: title.tmdbId,
        kind: title.kind,
        inWatchlist: title.listItems.length > 0,
        watched: title.watchedAt != null,
      },
    ];
  });
};
