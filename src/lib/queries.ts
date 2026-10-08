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
  catalog,
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
  type UserTitle,
} from "@/db";
import { flattenTitle, WITH_CATALOG, type RowWithCatalog } from "@/lib/catalog";
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

// Every title read joins its shared catalog row; `flattenTitle` folds it into
// the flat `Title` shape components expect (name, poster, keywords… + personal fields).
export const titleWithRelations = {
  ...WITH_CATALOG,
  listItems: { with: { list: true } },
} as const;

/** Film-level columns live on `Catalog`; the personal ones stay on `Title`. */
const joinCatalog = () => db.select({ title: titles, catalog }).from(titles).innerJoin(catalog, eq(titles.catalogId, catalog.id));

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
    return and(eq(catalog.kind, "SERIES"), isNull(titles.seriesStatus));
  }

  return and(eq(catalog.kind, "SERIES"), eq(titles.seriesStatus, filter));
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
        ilike(catalog.name, `%${q}%`),
        ilike(catalog.originalName, `%${q}%`),
        ilike(titles.review, `%${q}%`),
      )!,
    );
  }

  if (kind && kind !== "ALL") {
    conditions.push(eq(catalog.kind, kind));
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
      return [desc(titles.rating), asc(catalog.name)];
    case "name":
      return [asc(catalog.name)];
    case "year":
      return [desc(catalog.year), asc(catalog.name)];
    case "watched":
      return [desc(titles.watchedAt), asc(catalog.name)];
    default:
      return [desc(titles.updatedAt)];
  }
};

export const getTitles = cache(async (filters: TitleFilters = EMPTY_TITLE_FILTERS) => {
  const userId = await requireUserId();
  const { sort = "recent" } = filters;

  const rows = await joinCatalog()
    .where(and(...buildTitleConditions(userId, filters)))
    .orderBy(...titleOrderBy(sort));

  return rows.map((row) => flattenTitle({ ...row.title, catalog: row.catalog }));
});

export const getLatestWatchedMonth = cache(async (filters: TitleFilters = EMPTY_TITLE_FILTERS) => {
  const userId = await requireUserId();
  const rows = await db
    .select({ watchedAt: titles.watchedAt })
    .from(titles)
    .innerJoin(catalog, eq(titles.catalogId, catalog.id))
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

  const row = await db.query.titles.findFirst({
    where: and(eq(titles.id, id), eq(titles.userId, userId)),
    with: titleWithRelations,
  });

  return row ? flattenTitle(row) : undefined;
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
    from jsonb_array_elements(${catalog.tmdbGenres}) as genre
    where (genre->>'id')::int in (${genreList})
  )`;

  // One round-trip: the shared-genre count both filters and ranks.
  return db
    .select({
      id: titles.id,
      name: catalog.name,
      year: catalog.year,
      posterPath: catalog.posterPath,
    })
    .from(titles)
    .innerJoin(catalog, eq(titles.catalogId, catalog.id))
    .where(and(eq(titles.userId, userId), ne(titles.id, titleId), sql`${sharedGenres} > 0`))
    .orderBy(desc(sharedGenres), desc(titles.watchedAt), asc(catalog.name))
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
            columns: { id: true },
            with: { catalog: { columns: { name: true, posterPath: true } } },
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
      items: list.items.map((item) => ({
        ...item,
        title: {
          id: item.title.id,
          name: item.title.catalog?.name ?? "",
          posterPath: item.title.catalog?.posterPath ?? null,
        },
      })),
      _count: { items: counts.get(list.id) ?? 0 },
    })),
  );
});

/**
 * Lists carry their items' titles; fold each title's catalog in. Destructuring
 * (not spreading the generic) keeps the raw `catalog` key out of the result type.
 */
const flattenListItems = <
  TItem extends { title: RowWithCatalog<UserTitle> },
  TRest extends object,
>(
  list: (TRest & { items: TItem[] }) | undefined,
) => {
  if (!list) {
    return undefined;
  }
  const { items, ...rest } = list;
  return {
    ...rest,
    items: items.map((item) => {
      const { title, ...itemRest } = item;
      return { ...itemRest, title: flattenTitle(title) };
    }),
  };
};

export const getWatchlist = cache(async () => {
  const userId = await requireUserId();

  const list = await db.query.lists.findFirst({
    where: and(eq(lists.userId, userId), eq(lists.slug, WATCHLIST_SLUG)),
    with: {
      items: {
        orderBy: [asc(listItems.position)],
        with: {
          title: { with: WITH_CATALOG },
        },
      },
    },
  });

  return flattenListItems(list);
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

  const list = await db.query.lists.findFirst({
    where: and(eq(lists.id, id), eq(lists.userId, userId)),
    with: {
      items: {
        orderBy: [asc(listItems.position)],
        with: {
          title: { with: WITH_CATALOG },
        },
      },
    },
  });

  return flattenListItems(list);
});

/** List row only — avoids hydrating every ListItem/Title on editar. */
export const getListMetaById = cache(async (id: string) => {
  const userId = await requireUserId();

  return db.query.lists.findFirst({
    where: and(eq(lists.id, id), eq(lists.userId, userId)),
  });
});

export const getListItemCount = cache(async (listId: string) => {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(listItems)
    .where(eq(listItems.listId, listId));

  return row?.count ?? 0;
});

export const getTitleOptions = cache(async () => {
  const userId = await requireUserId();

  return db
    .select({ id: titles.id, name: catalog.name, year: catalog.year, posterPath: catalog.posterPath })
    .from(titles)
    .innerJoin(catalog, eq(titles.catalogId, catalog.id))
    .where(eq(titles.userId, userId))
    .orderBy(asc(catalog.name));
});

/** Titles not already on the list — SQL exclusion instead of load-all + filter. */
export const getTitleOptionsOutsideList = cache(async (listId: string) => {
  const userId = await requireUserId();

  return db
    .select({
      id: titles.id,
      name: catalog.name,
      year: catalog.year,
      posterPath: catalog.posterPath,
      tmdbId: catalog.tmdbId,
      kind: catalog.kind,
    })
    .from(titles)
    .innerJoin(catalog, eq(titles.catalogId, catalog.id))
    .where(
      and(
        eq(titles.userId, userId),
        notInArray(
          titles.id,
          db
            .select({ titleId: listItems.titleId })
            .from(listItems)
            .where(eq(listItems.listId, listId)),
        ),
      ),
    )
    .orderBy(asc(catalog.name));
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
  const rows = await db.query.titles.findMany({
    where: and(eq(titles.userId, userId), isNotNull(titles.watchedAt)),
    orderBy: [desc(titles.watchedAt), asc(titles.createdAt)],
    limit,
    with: WITH_CATALOG,
  });
  return rows.map((row) => flattenTitle(row));
});

/** Perfil week strip: everything watched since `since` (inclusive). */
export const getWatchedSince = cache(async (since: Date) => {
  const userId = await requireUserId();
  const rows = await db.query.titles.findMany({
    where: and(eq(titles.userId, userId), gte(titles.watchedAt, since)),
    orderBy: [desc(titles.watchedAt)],
    with: WITH_CATALOG,
  });
  return rows.map((row) => flattenTitle(row));
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
      where: and(eq(titles.userId, userId), isNotNull(titles.catalogId)),
      columns: { id: true, watchedAt: true },
      with: { catalog: { columns: { tmdbId: true, kind: true } } },
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
    if (!title.catalog) {
      return [];
    }

    return [
      {
        titleId: title.id,
        tmdbId: title.catalog.tmdbId,
        kind: title.catalog.kind,
        inWatchlist: watchlistIds.has(title.id),
        watched: title.watchedAt != null,
      },
    ];
  });
});

/** Buscar «Agregar a lista»: list ids per title, so the picker starts on what is saved. */
export const getUserListMembershipIndex = cache(
  async (): Promise<Record<string, string[]>> => {
    const userId = await requireUserId();

    const rows = await db
      .select({ titleId: listItems.titleId, listId: listItems.listId })
      .from(listItems)
      .innerJoin(lists, eq(lists.id, listItems.listId))
      .where(eq(lists.userId, userId));

    const index: Record<string, string[]> = {};
    for (const row of rows) {
      (index[row.titleId] ??= []).push(row.listId);
    }
    return index;
  },
);
