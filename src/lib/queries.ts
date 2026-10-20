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
} from "@/db";
import { flattenTitle, WITH_CATALOG } from "@/lib/catalog";
import { monthUtcRange, toDateInput } from "@/lib/dates";
import { listAccessFor } from "@/lib/list-access";
import { getMembersByList } from "@/lib/list-invites";
import { canOnList } from "@/lib/list-access-core";
import { loadListItems, withOwnListEntries } from "@/lib/list-items";
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
// The lists holding the film are laid on afterwards (`withOwnListEntries`):
// list items are keyed by catalog, not by Title (FIL-I18).
export const titleWithRelations = WITH_CATALOG;

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

/** One user's titles with their catalog, filtered and sorted (Diario, Quiero ver, MCP). */
export const loadTitles = async (userId: string, filters: TitleFilters = EMPTY_TITLE_FILTERS) => {
  const { sort = "recent" } = filters;

  const rows = await joinCatalog()
    .where(and(...buildTitleConditions(userId, filters)))
    .orderBy(...titleOrderBy(sort));

  return rows.map((row) => flattenTitle({ ...row.title, catalog: row.catalog }));
};

export const getTitles = cache(async (filters: TitleFilters = EMPTY_TITLE_FILTERS) => loadTitles(await requireUserId(), filters));

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

/** One of the user's titles with its own list entries (the ficha, MCP). */
export const loadTitleById = async (userId: string, id: string) => {

  const row = await db.query.titles.findFirst({
    where: and(eq(titles.id, id), eq(titles.userId, userId)),
    with: titleWithRelations,
  });
  if (!row) {
    return undefined;
  }

  const [withLists] = await withOwnListEntries(userId, [flattenTitle(row)]);
  return withLists;
};

export const getTitleById = cache(async (id: string) => loadTitleById(await requireUserId(), id));

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

/** The lists a user owns, with a preview, counts and members (Listas, MCP). */
export const loadLists = async (userId: string) => {

  const rows = await db.query.lists.findMany({
    where: eq(lists.userId, userId),
    with: {
      items: {
        orderBy: [asc(listItems.position)],
        limit: 5,
        with: { catalog: { columns: { id: true, name: true, posterPath: true } } },
      },
    },
  });

  const counts = await countByIds(
    listItems.listId,
    listItems,
    rows.map((row) => row.id),
  );

  const members = await getMembersByList(rows.map((row) => row.id));

  return sortUserLists(
    rows.map((list) => ({
      members: members.get(list.id) ?? [],
      ...list,
      items: list.items.map(({ catalog: film, ...item }) => ({
        ...item,
        title: {
          id: film.id,
          name: film.name,
          posterPath: film.posterPath,
        },
      })),
      _count: { items: counts.get(list.id) ?? 0 },
    })),
  );
};

export const getLists = cache(async () => loadLists(await requireUserId()));

/** The user's Quiero ver with its items (Quiero ver, MCP). */
export const loadWatchlist = async (userId: string) => {

  const list = await db.query.lists.findFirst({
    where: and(eq(lists.userId, userId), eq(lists.slug, WATCHLIST_SLUG)),
  });
  if (!list) {
    return undefined;
  }

  return { ...list, items: await loadListItems([list.id], userId) };
};

export const getWatchlist = cache(async () => loadWatchlist(await requireUserId()));

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

  const [item] = await db
    .select({ listId: listItems.listId })
    .from(listItems)
    .innerJoin(titles, eq(titles.catalogId, listItems.catalogId))
    .where(
      and(eq(listItems.listId, watchlist.id), eq(titles.id, titleId), eq(titles.userId, userId)),
    )
    .limit(1);

  return Boolean(item);
});

export const getAssignableLists = cache(async () => {
  const userId = await requireUserId();

  const rows = await db.query.lists.findMany({
    // Tu top 10 del año is built from Cine (only films of that year you saw), never from a picker.
    where: and(eq(lists.userId, userId), ne(lists.kind, "YEAR_TOP")),
    columns: { id: true, name: true, slug: true, kind: true },
  });

  return sortUserLists(rows);
});

/** A list you own or were let into, with your role; undefined otherwise (the page 404s). */
/** A list the user owns or was let into, with their role; undefined otherwise. */
export const loadListById = async (userId: string, id: string) => {
  const access = await listAccessFor(id, userId);
  if (!access) {
    return undefined;
  }

  return { ...access.list, role: access.role, items: await loadListItems([id], userId) };
};

export const getListById = cache(async (id: string) => loadListById(await requireUserId(), id));

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
  const access = await listAccessFor(listId, userId);
  if (!canOnList(access?.role ?? null, "edit_items")) {
    return [];
  }

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
          titles.catalogId,
          db
            .select({ catalogId: listItems.catalogId })
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

/** Everything watched from `since` (inclusive) until `until` (exclusive), newest first (diario, MCP). */
export const loadWatchedBetween = async (userId: string, since: Date, until?: Date) => {
  const rows = await db.query.titles.findMany({
    where: and(
      eq(titles.userId, userId),
      gte(titles.watchedAt, since),
      until ? lt(titles.watchedAt, until) : undefined,
    ),
    orderBy: [desc(titles.watchedAt), asc(titles.createdAt)],
    with: WITH_CATALOG,
  });
  return rows.map((row) => flattenTitle(row));
};

/** Perfil week strip: everything watched since `since` (inclusive). */
export const getWatchedSince = cache(async (since: Date) => loadWatchedBetween(await requireUserId(), since));

/** The account's profile by id; the session-bound page and the MCP connector both read it. */
export const loadUserProfile = async (userId: string) => {
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
};

export const getCurrentUserProfile = cache(async () => loadUserProfile(await requireUserId()));

export type UserTmdbEntry = {
  titleId: string;
  tmdbId: number;
  kind: TitleKind;
  inWatchlist: boolean;
  watched: boolean;
};

/** Every title of the user by TMDB id, with Quiero ver / watched flags (Buscar, MCP). */
export const loadUserTmdbIndex = async (userId: string): Promise<UserTmdbEntry[]> => {

  const [titleRows, watchlist] = await Promise.all([
    db.query.titles.findMany({
      where: and(eq(titles.userId, userId), isNotNull(titles.catalogId)),
      columns: { id: true, catalogId: true, watchedAt: true },
      with: { catalog: { columns: { tmdbId: true, kind: true } } },
    }),
    db.query.lists.findFirst({
      where: and(eq(lists.userId, userId), eq(lists.slug, WATCHLIST_SLUG)),
      columns: { id: true },
      with: {
        items: {
          columns: { catalogId: true },
        },
      },
    }),
  ]);

  const watchlistIds = new Set(watchlist?.items.map((item) => item.catalogId) ?? []);

  return titleRows.flatMap((title) => {
    if (!title.catalog) {
      return [];
    }

    return [
      {
        titleId: title.id,
        tmdbId: title.catalog.tmdbId,
        kind: title.catalog.kind,
        inWatchlist: watchlistIds.has(title.catalogId),
        watched: title.watchedAt != null,
      },
    ];
  });
};

export const getUserTmdbIndex = cache(async (): Promise<UserTmdbEntry[]> => loadUserTmdbIndex(await requireUserId()));

/** Buscar «Agregar a lista»: list ids per title, so the picker starts on what is saved. */
export const getUserListMembershipIndex = cache(
  async (): Promise<Record<string, string[]>> => {
    const userId = await requireUserId();

    const rows = await db
      .select({ titleId: titles.id, listId: listItems.listId })
      .from(listItems)
      .innerJoin(lists, eq(lists.id, listItems.listId))
      .innerJoin(titles, and(eq(titles.catalogId, listItems.catalogId), eq(titles.userId, userId)))
      .where(eq(lists.userId, userId));

    const index: Record<string, string[]> = {};
    for (const row of rows) {
      (index[row.titleId] ??= []).push(row.listId);
    }
    return index;
  },
);
