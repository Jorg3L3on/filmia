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
  ne,
  or,
  sql,
} from "drizzle-orm";
import { cache } from "react";
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
  type TitleWithTags,
} from "@/db";
import { sortUserLists } from "@/lib/lists";
import { requireUserId } from "@/lib/session";
import { type SeriesStatusFilter } from "@/lib/series";
import { parseStoredStreamingPlatforms } from "@/lib/streaming-platforms";
import { WATCHLIST_SLUG } from "@/lib/watchlist";

export type {
  TitleKind,
  SeriesStatus,
  Platform,
  ListKind,
  TitleWithRelations,
  TitleWithTags,
};

export const titleWithTags = {
  tags: { with: { tag: true } },
} as const;

export const titleWithRelations = {
  ...titleWithTags,
  listItems: { with: { list: true } },
} as const;

/** @deprecated Use TitleWithRelations — kept for gradual migration of type imports */
export const titleInclude = titleWithRelations;

export type FilterTag = {
  id: string;
  name: string;
  slug: string;
  _count: { titles: number };
};

type TitleFilters = {
  q?: string;
  kind?: TitleKind | "ALL";
  platform?: Platform | "ALL";
  tags?: string[];
  sort?: "recent" | "watched" | "rating" | "name" | "year";
  onlyWatched?: boolean;
  seriesStatus?: SeriesStatusFilter;
};

const EMPTY_TITLE_FILTERS: TitleFilters = {};

const countByIds = async (
  column: typeof titleTags.tagId | typeof listItems.listId,
  table: typeof titleTags | typeof listItems,
  ids: string[],
) => {
  if (ids.length === 0) {
    return new Map<string, number>();
  }

  const rows = await db
    .select({
      id: column,
      count: sql<number>`count(*)::int`,
    })
    .from(table)
    .where(inArray(column, ids))
    .groupBy(column);

  return new Map(rows.map((row) => [row.id, row.count]));
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

export const getTitles = cache(async (filters: TitleFilters = EMPTY_TITLE_FILTERS) => {
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
    with: titleWithTags,
    orderBy: titleOrderBy(sort),
  });
});

export const getTitleById = cache(async (id: string) => {
  const userId = await requireUserId();

  return db.query.titles.findFirst({
    where: and(eq(titles.id, id), eq(titles.userId, userId)),
    with: titleWithRelations,
  });
});

export const getRelatedTitles = cache(async (titleId: string, tagIds: string[]) => {
  if (tagIds.length === 0) {
    return [];
  }

  const userId = await requireUserId();

  // Relational `findMany` aliases `Title` as `"titles"`. A correlated
  // `exists` that still references `titles.id` emits `"Title"."id"` and
  // Postgres rejects it. Resolve matching ids first, then load posters.
  const matching = await db
    .selectDistinct({ titleId: titleTags.titleId })
    .from(titleTags)
    .innerJoin(titles, eq(titles.id, titleTags.titleId))
    .where(
      and(
        eq(titles.userId, userId),
        ne(titles.id, titleId),
        inArray(titleTags.tagId, tagIds),
      ),
    );

  if (matching.length === 0) {
    return [];
  }

  return db.query.titles.findMany({
    where: inArray(
      titles.id,
      matching.map((row) => row.titleId),
    ),
    columns: {
      id: true,
      name: true,
      year: true,
      posterPath: true,
    },
    orderBy: [desc(titles.watchedAt), asc(titles.name)],
    limit: 12,
  });
});

export const getTagFilters = cache(async (): Promise<FilterTag[]> => {
  const userId = await requireUserId();

  const rows = await db.query.tags.findMany({
    where: eq(tags.userId, userId),
    columns: { id: true, name: true, slug: true },
    orderBy: [asc(tags.name)],
  });

  const counts = await countByIds(
    titleTags.tagId,
    titleTags,
    rows.map((row) => row.id),
  );

  return rows.map((row) => ({
    ...row,
    _count: { titles: counts.get(row.id) ?? 0 },
  }));
});

export const getTags = cache(async () => {
  const userId = await requireUserId();

  const rows = await db.query.tags.findMany({
    where: eq(tags.userId, userId),
    orderBy: [asc(tags.name)],
    with: {
      titles: {
        limit: 3,
        with: {
          title: {
            columns: { id: true, name: true, posterPath: true },
          },
        },
      },
    },
  });

  const counts = await countByIds(
    titleTags.tagId,
    titleTags,
    rows.map((row) => row.id),
  );

  return rows.map((row) => ({
    ...row,
    _count: { titles: counts.get(row.id) ?? 0 },
  }));
});

export const getTagBySlug = cache(async (slug: string) => {
  const userId = await requireUserId();

  const row = await db.query.tags.findFirst({
    where: and(eq(tags.userId, userId), eq(tags.slug, slug)),
    columns: {
      id: true,
      userId: true,
      name: true,
      slug: true,
      createdAt: true,
    },
  });

  if (!row) {
    return null;
  }

  const countRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(titleTags)
    .where(eq(titleTags.tagId, row.id));

  return {
    ...row,
    _count: { titles: countRows[0]?.count ?? 0 },
  };
});

export const getLists = cache(async () => {
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

  const counts = await countByIds(
    listItems.listId,
    listItems,
    rows.map((row) => row.id),
  );

  return sortUserLists(
    rows.map((list) => ({
      ...list,
      _count: { items: counts.get(list.id) ?? 0 },
    })),
  );
});

export const getWatchlist = cache(async () => {
  const userId = await requireUserId();

  return db.query.lists.findFirst({
    where: and(eq(lists.userId, userId), eq(lists.slug, WATCHLIST_SLUG)),
    with: {
      items: {
        orderBy: [asc(listItems.position)],
        with: {
          title: { with: titleWithTags },
        },
      },
    },
  });
});

export const getWatchlistCount = cache(async () => {
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
});

export const isTitleInWatchlist = cache(async (titleId: string) => {
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
});

export const getCollectionLists = cache(async () => {
  const userId = await requireUserId();

  const rows = await db.query.lists.findMany({
    where: and(eq(lists.userId, userId), eq(lists.kind, "COLLECTION")),
    columns: { id: true, name: true, slug: true },
  });

  return sortUserLists(rows);
});

export const getAssignableLists = cache(async () => {
  const userId = await requireUserId();

  const rows = await db.query.lists.findMany({
    where: eq(lists.userId, userId),
    columns: { id: true, name: true, slug: true, kind: true },
  });

  return sortUserLists(rows);
});

export const getListById = cache(async (id: string) => {
  const userId = await requireUserId();

  return db.query.lists.findFirst({
    where: and(eq(lists.id, id), eq(lists.userId, userId)),
    with: {
      items: {
        orderBy: [asc(listItems.position)],
        with: {
          title: { with: titleWithTags },
        },
      },
    },
  });
});

export const getTitleOptions = cache(async () => {
  const userId = await requireUserId();

  return db.query.titles.findMany({
    where: eq(titles.userId, userId),
    columns: { id: true, name: true, year: true, posterPath: true },
    orderBy: [asc(titles.name)],
  });
});

export const getUserStreamingPlatforms = cache(async () => {
  const userId = await requireUserId();
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { streamingPlatforms: true },
  });

  return parseStoredStreamingPlatforms(user?.streamingPlatforms);
});

export const getCurrentUserProfile = cache(async () => {
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
});

export type UserTmdbEntry = {
  titleId: string;
  tmdbId: number;
  kind: TitleKind;
  inWatchlist: boolean;
  watched: boolean;
};

export const getUserTmdbIndex = cache(async (): Promise<UserTmdbEntry[]> => {
  const userId = await requireUserId();

  const [titleRows, watchlist] = await Promise.all([
    db.query.titles.findMany({
      where: and(eq(titles.userId, userId), isNotNull(titles.tmdbId)),
      columns: {
        id: true,
        tmdbId: true,
        kind: true,
        watchedAt: true,
      },
    }),
    db.query.lists.findFirst({
      where: and(eq(lists.userId, userId), eq(lists.slug, WATCHLIST_SLUG)),
      columns: { id: true },
      with: {
        items: {
          columns: { titleId: true },
        },
      },
    }),
  ]);

  const watchlistIds = new Set(watchlist?.items.map((item) => item.titleId) ?? []);

  return titleRows.flatMap((title) => {
    if (title.tmdbId == null) {
      return [];
    }

    return [
      {
        titleId: title.id,
        tmdbId: title.tmdbId,
        kind: title.kind,
        inWatchlist: watchlistIds.has(title.id),
        watched: title.watchedAt != null,
      },
    ];
  });
});
