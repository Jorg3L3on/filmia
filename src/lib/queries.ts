import {
  and,
  asc,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lt,
  ne,
  notInArray,
  or,
  sql,
} from "drizzle-orm";
import { cache } from "react";
import {
  db,
  listItems,
  lists,
  titles,
  users,
  type ListKind,
  type Platform,
  type SeriesStatus,
  type TitleKind,
  type TitleWithRelations,
} from "@/db";
import { monthUtcRange, toDateInput } from "@/lib/dates";
import { sortUserLists } from "@/lib/lists";
import { requireUserId } from "@/lib/session";
import { type SeriesStatusFilter } from "@/lib/series";
import { parseStoredStreamingPlatforms } from "@/lib/streaming-platforms";
import { parseNightEnds } from "@/lib/tonight/time";
import { WATCHLIST_SLUG } from "@/lib/watchlist";

export type {
  TitleKind,
  SeriesStatus,
  Platform,
  ListKind,
  TitleWithRelations,
};

export const titleWithRelations = {
  listItems: { with: { list: true } },
} as const;

/** @deprecated Use TitleWithRelations — kept for gradual migration of type imports */
export const titleInclude = titleWithRelations;

type TitleFilters = {
  q?: string;
  kind?: TitleKind | "ALL";
  platform?: Platform | "ALL";
  sort?: "recent" | "watched" | "rating" | "name" | "year";
  onlyWatched?: boolean;
  seriesStatus?: SeriesStatusFilter;
  watchedMonth?: string;
};

const EMPTY_TITLE_FILTERS: TitleFilters = {};

const countByIds = async (
  column: typeof listItems.listId,
  table: typeof listItems,
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

const buildTitleConditions = (userId: string, filters: TitleFilters) => {
  const {
    q,
    kind,
    platform,
    onlyWatched = false,
    seriesStatus,
    watchedMonth,
  } = filters;
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

  if (onlyWatched) {
    conditions.push(isNotNull(titles.watchedAt));
  }

  if (watchedMonth) {
    const { start, end } = monthUtcRange(watchedMonth);
    conditions.push(gte(titles.watchedAt, start));
    conditions.push(lt(titles.watchedAt, end));
  }

  const seriesCondition = buildSeriesStatusCondition(seriesStatus);
  if (seriesCondition) {
    conditions.push(seriesCondition);
  }

  return conditions;
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
  const { sort = "recent" } = filters;

  return db.query.titles.findMany({
    where: and(...buildTitleConditions(userId, filters)),
    orderBy: titleOrderBy(sort),
  });
});

export const getLatestWatchedMonth = cache(async (filters: TitleFilters = EMPTY_TITLE_FILTERS) => {
  const userId = await requireUserId();
  const rows = await db
    .select({ watchedAt: titles.watchedAt })
    .from(titles)
    .where(
      and(
        ...buildTitleConditions(userId, {
          ...filters,
          onlyWatched: true,
          watchedMonth: undefined,
        }),
      ),
    )
    .orderBy(desc(titles.watchedAt))
    .limit(1);

  const watchedAt = rows[0]?.watchedAt;
  if (!watchedAt) {
    return null;
  }

  return toDateInput(watchedAt).slice(0, 7) || null;
});

export const getTitleById = cache(async (id: string) => {
  const userId = await requireUserId();

  return db.query.titles.findFirst({
    where: and(eq(titles.id, id), eq(titles.userId, userId)),
    with: titleWithRelations,
  });
});

/** Ficha «Relacionadas»: titles sharing TMDB genres, most shared first. */
export const getRelatedTitles = cache(async (titleId: string, genreIds: number[]) => {
  if (genreIds.length === 0) {
    return [];
  }

  const userId = await requireUserId();
  const genreList = sql.join(
    genreIds.map((id) => sql`${id}`),
    sql`, `,
  );
  const sharedGenres = sql<number>`(
    select count(*)::int
    from jsonb_array_elements(${titles.tmdbGenres}) as genre
    where (genre->>'id')::int in (${genreList})
  )`;

  // One round-trip: the shared-genre count both filters and ranks.
  return db
    .select({
      id: titles.id,
      name: titles.name,
      year: titles.year,
      posterPath: titles.posterPath,
    })
    .from(titles)
    .where(and(eq(titles.userId, userId), ne(titles.id, titleId), sql`${sharedGenres} > 0`))
    .orderBy(desc(sharedGenres), desc(titles.watchedAt), asc(titles.name))
    .limit(12);
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
          title: true,
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
          title: true,
        },
      },
    },
  });
});

/** List row only — avoids hydrating every ListItem/Title on editar. */
export const getListMetaById = cache(async (id: string) => {
  const userId = await requireUserId();

  return db.query.lists.findFirst({
    where: and(eq(lists.id, id), eq(lists.userId, userId)),
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

/** Titles not already on the list — SQL exclusion instead of load-all + filter. */
export const getTitleOptionsOutsideList = cache(async (listId: string) => {
  const userId = await requireUserId();

  return db.query.titles.findMany({
    where: and(
      eq(titles.userId, userId),
      notInArray(
        titles.id,
        db
          .select({ titleId: listItems.titleId })
          .from(listItems)
          .where(eq(listItems.listId, listId)),
      ),
    ),
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

/** Perfil «Tu diario»: last entries, newest first (rating + review ride along). */
export const getRecentWatchedTitles = cache(async (limit = 3) => {
  const userId = await requireUserId();
  return db.query.titles.findMany({
    where: and(eq(titles.userId, userId), isNotNull(titles.watchedAt)),
    orderBy: [desc(titles.watchedAt), asc(titles.name)],
    limit,
  });
});

/** Perfil week strip: everything watched since `since` (inclusive). */
export const getWatchedSince = cache(async (since: Date) => {
  const userId = await requireUserId();
  return db.query.titles.findMany({
    where: and(eq(titles.userId, userId), gte(titles.watchedAt, since)),
    orderBy: [desc(titles.watchedAt)],
  });
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
      nightEndsAt: true,
      onboardedAt: true,
      onboardingStep: true,
      createdAt: true,
      passwordHash: true,
      googleId: true,
    },
  });

  if (!user) {
    return null;
  }

  const { passwordHash, googleId, ...account } = user;

  return {
    ...account,
    hasPassword: Boolean(passwordHash),
    googleLinked: Boolean(googleId),
    streamingPlatforms: parseStoredStreamingPlatforms(user.streamingPlatforms),
    nightEnds: parseNightEnds(user.nightEndsAt),
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
