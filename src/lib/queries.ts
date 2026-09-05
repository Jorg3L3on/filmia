import {
  and,
  asc,
  desc,
  eq,
  exists,
  ilike,
  inArray,
  isNotNull,
  isNull,
  or,
  sql,
} from "drizzle-orm";
import {
  db,
  listItems,
  lists,
  tags,
  titleTags,
  titles,
  users,
  type ListKind,
  type Platform,
  type SeriesStatus,
  type TitleKind,
  type TitleWithRelations,
} from "@/db";
import { sortUserLists } from "@/lib/lists";
import { requireUserId } from "@/lib/session";
import { type SeriesStatusFilter } from "@/lib/series";
import { parseStoredStreamingPlatforms } from "@/lib/streaming-platforms";
import { WATCHLIST_SLUG } from "@/lib/watchlist";

export type { TitleKind, SeriesStatus, Platform, ListKind, TitleWithRelations };

export const titleWithRelations = {
  tags: { with: { tag: true } },
  listItems: { with: { list: true } },
} as const;

/** @deprecated Use TitleWithRelations — kept for gradual migration of type imports */
export const titleInclude = titleWithRelations;

type TitleFilters = {
  q?: string;
  kind?: TitleKind | "ALL";
  platform?: Platform | "ALL";
  tags?: string[];
  sort?: "recent" | "watched" | "rating" | "name" | "year";
  onlyWatched?: boolean;
  seriesStatus?: SeriesStatusFilter;
};

const buildSeriesStatusCondition = (filter: SeriesStatusFilter | undefined) => {
  if (!filter) {
    return undefined;
  }

  if (filter === "NONE") {
    return and(eq(titles.kind, "SERIES"), isNull(titles.seriesStatus));
  }

  return and(eq(titles.kind, "SERIES"), eq(titles.seriesStatus, filter));
};

const buildTagSlugCondition = (userId: string, tagSlugs: string[]) => {
  if (tagSlugs.length === 0) {
    return undefined;
  }

  return exists(
    db
      .select({ titleId: titleTags.titleId })
      .from(titleTags)
      .innerJoin(tags, eq(titleTags.tagId, tags.id))
      .where(
        and(
          eq(titleTags.titleId, titles.id),
          inArray(tags.slug, tagSlugs),
          eq(tags.userId, userId),
        ),
      ),
  );
};

const titleOrderBy = (sort: TitleFilters["sort"]) => {
  switch (sort) {
    case "rating":
      return [desc(titles.rating), asc(titles.name)];
    case "name":
      return [asc(titles.name)];
    case "year":
      return [desc(titles.year), asc(titles.name)];
    case "watched":
      return [desc(titles.watchedAt), asc(titles.name)];
    default:
      return [desc(titles.updatedAt)];
  }
};

export const getTitles = async (filters: TitleFilters = {}) => {
  const userId = await requireUserId();
  const {
    q,
    kind,
    platform,
    tags: tagFilter,
    sort = "recent",
    onlyWatched = false,
    seriesStatus,
  } = filters;
  const tagSlugs = [...new Set((tagFilter ?? []).map((slug) => slug.trim()).filter(Boolean))];

  const conditions = [eq(titles.userId, userId)];

  if (q) {
    conditions.push(
      or(
        ilike(titles.name, `%${q}%`),
        ilike(titles.originalName, `%${q}%`),
        ilike(titles.review, `%${q}%`),
      )!,
    );
  }

  if (kind && kind !== "ALL") {
    conditions.push(eq(titles.kind, kind));
  }

  if (platform && platform !== "ALL") {
    conditions.push(eq(titles.platform, platform));
  }

  const tagCondition = buildTagSlugCondition(userId, tagSlugs);
  if (tagCondition) {
    conditions.push(tagCondition);
  }

  if (onlyWatched) {
    conditions.push(isNotNull(titles.watchedAt));
  }

  const seriesCondition = buildSeriesStatusCondition(seriesStatus);
  if (seriesCondition) {
    conditions.push(seriesCondition);
  }

  return db.query.titles.findMany({
    where: and(...conditions),
    with: titleWithRelations,
    orderBy: titleOrderBy(sort),
  });
};

export const getTitleById = async (id: string) => {
  const userId = await requireUserId();

  return db.query.titles.findFirst({
    where: and(eq(titles.id, id), eq(titles.userId, userId)),
    with: titleWithRelations,
  });
};

export const getTags = async () => {
  const userId = await requireUserId();

  const rows = await db.query.tags.findMany({
    where: eq(tags.userId, userId),
    orderBy: [asc(tags.name)],
    with: { titles: { columns: { titleId: true } } },
  });

  return rows.map(({ titles: titleLinks, ...tag }) => ({
    ...tag,
    _count: { titles: titleLinks.length },
  }));
};

export const getTagBySlug = async (slug: string) => {
  const userId = await requireUserId();

  const row = await db.query.tags.findFirst({
    where: and(eq(tags.userId, userId), eq(tags.slug, slug)),
    with: { titles: { columns: { titleId: true } } },
  });

  if (!row) {
    return null;
  }

  const { titles: titleLinks, ...tag } = row;
  return {
    ...tag,
    _count: { titles: titleLinks.length },
  };
};

export const getLists = async () => {
  const userId = await requireUserId();

  const rows = await db.query.lists.findMany({
    where: eq(lists.userId, userId),
    with: {
      items: {
        orderBy: [asc(listItems.position)],
        limit: 5,
        with: {
          title: {
            columns: { id: true, name: true, posterPath: true },
          },
        },
      },
    },
  });

  const withCounts = await Promise.all(
    rows.map(async (list) => {
      const countRows = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(listItems)
        .where(eq(listItems.listId, list.id));

      return {
        ...list,
        _count: { items: countRows[0]?.count ?? 0 },
      };
    }),
  );

  return sortUserLists(withCounts);
};

export const getWatchlist = async () => {
  const userId = await requireUserId();

  return db.query.lists.findFirst({
    where: and(eq(lists.userId, userId), eq(lists.slug, WATCHLIST_SLUG)),
    with: {
      items: {
        orderBy: [asc(listItems.position)],
        with: {
          title: { with: titleWithRelations },
        },
      },
    },
  });
};

export const getWatchlistCount = async () => {
  const userId = await requireUserId();

  const watchlist = await db.query.lists.findFirst({
    where: and(eq(lists.userId, userId), eq(lists.slug, WATCHLIST_SLUG)),
    columns: { id: true },
  });

  if (!watchlist) {
    return 0;
  }

  const countRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(listItems)
    .where(eq(listItems.listId, watchlist.id));

  return countRows[0]?.count ?? 0;
};

export const isTitleInWatchlist = async (titleId: string) => {
  const userId = await requireUserId();

  const watchlist = await db.query.lists.findFirst({
    where: and(eq(lists.userId, userId), eq(lists.slug, WATCHLIST_SLUG)),
    columns: { id: true },
  });

  if (!watchlist) {
    return false;
  }

  const item = await db.query.listItems.findFirst({
    where: and(eq(listItems.listId, watchlist.id), eq(listItems.titleId, titleId)),
  });

  return Boolean(item);
};

export const getCollectionLists = async () => {
  const userId = await requireUserId();

  const rows = await db.query.lists.findMany({
    where: and(eq(lists.userId, userId), eq(lists.kind, "COLLECTION")),
    columns: { id: true, name: true, slug: true },
  });

  return sortUserLists(rows);
};

export const getAssignableLists = async () => {
  const userId = await requireUserId();

  const rows = await db.query.lists.findMany({
    where: eq(lists.userId, userId),
    columns: { id: true, name: true, slug: true, kind: true },
  });

  return sortUserLists(rows);
};

export const getListById = async (id: string) => {
  const userId = await requireUserId();

  return db.query.lists.findFirst({
    where: and(eq(lists.id, id), eq(lists.userId, userId)),
    with: {
      items: {
        orderBy: [asc(listItems.position)],
        with: {
          title: { with: titleWithRelations },
        },
      },
    },
  });
};

export const getTitleOptions = async () => {
  const userId = await requireUserId();

  return db.query.titles.findMany({
    where: eq(titles.userId, userId),
    columns: { id: true, name: true, year: true },
    orderBy: [asc(titles.name)],
  });
};

export const getUserStreamingPlatforms = async () => {
  const userId = await requireUserId();
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { streamingPlatforms: true },
  });

  return parseStoredStreamingPlatforms(user?.streamingPlatforms);
};

export const getCurrentUserProfile = async () => {
  const userId = await requireUserId();
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {
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

  const rows = await db.query.titles.findMany({
    where: and(eq(titles.userId, userId), isNotNull(titles.tmdbId)),
    columns: {
      id: true,
      tmdbId: true,
      kind: true,
      watchedAt: true,
    },
    with: {
      listItems: {
        with: {
          list: {
            columns: { slug: true },
          },
        },
      },
    },
  });

  return rows.flatMap((title) => {
    if (title.tmdbId == null) {
      return [];
    }

    return [
      {
        titleId: title.id,
        tmdbId: title.tmdbId,
        kind: title.kind,
        inWatchlist: title.listItems.some((item) => item.list.slug === WATCHLIST_SLUG),
        watched: title.watchedAt != null,
      },
    ];
  });
};
