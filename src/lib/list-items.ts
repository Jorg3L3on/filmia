import { and, asc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { catalog, db, listItems, lists, titles, type CatalogRow, type List, type ListItem, type UserTitle } from "@/db";
import { flattenTitle } from "@/lib/catalog";

/**
 * List items are keyed by the shared Catalog row (FIL-I18). Everything personal
 * (rating, watched, the ficha link) comes from the viewer's own Title for that
 * film, when they have one: on a shared list an editor can add films the
 * viewer never saved.
 */

/**
 * The flat Title shape for a film the viewer has not saved: nothing personal,
 * and the catalog id as its id so cards stay keyed and `/titulos/{id}`
 * redirects to the preview ficha.
 */
export const titleWithoutEntry = (row: CatalogRow) =>
  flattenTitle({
    id: row.id,
    userId: "",
    catalogId: row.id,
    rating: null,
    review: null,
    platform: null,
    watchedAt: null,
    seriesStatus: null,
    seriesSeason: null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    catalog: row,
  });

const viewerTitle = (title: UserTitle | null, row: CatalogRow) =>
  title ? flattenTitle({ ...title, catalog: row }) : titleWithoutEntry(row);

export type ListItemWithTitle = ListItem & { title: ReturnType<typeof flattenTitle> };

/**
 * Items of the given lists in position order, each with the viewer's flattened
 * Title (or a Title without entry). Callers must have checked access to the lists.
 */
export const loadListItems = async (
  listIds: string[],
  viewerId: string,
): Promise<ListItemWithTitle[]> => {
  if (listIds.length === 0) {
    return [];
  }

  const rows = await db
    .select({ item: listItems, catalog, title: titles })
    .from(listItems)
    .innerJoin(catalog, eq(catalog.id, listItems.catalogId))
    .leftJoin(titles, and(eq(titles.catalogId, listItems.catalogId), eq(titles.userId, viewerId)))
    .where(inArray(listItems.listId, listIds))
    .orderBy(asc(listItems.position), asc(catalog.name));

  return rows.map((row) => ({ ...row.item, title: viewerTitle(row.title, row.catalog) }));
};

export type OwnListEntry = ListItem & { list: List };

/** The user's own lists that hold each film, keyed by catalogId. */
export const ownListEntriesByCatalog = async (
  userId: string,
  catalogIds: string[],
): Promise<Map<string, OwnListEntry[]>> => {
  const index = new Map<string, OwnListEntry[]>();
  if (catalogIds.length === 0) {
    return index;
  }

  const rows = await db
    .select({ item: listItems, list: lists })
    .from(listItems)
    .innerJoin(lists, eq(lists.id, listItems.listId))
    .where(and(eq(lists.userId, userId), inArray(listItems.catalogId, catalogIds)));

  for (const { item, list } of rows) {
    const entries = index.get(item.catalogId) ?? [];
    entries.push({ ...item, list });
    index.set(item.catalogId, entries);
  }
  return index;
};

/** Lays `listItems` (the user's own lists holding the film) on each title. */
export const withOwnListEntries = async <T extends { catalogId: string }>(
  userId: string,
  rows: T[],
): Promise<Array<T & { listItems: OwnListEntry[] }>> => {
  const index = await ownListEntriesByCatalog(
    userId,
    rows.map((row) => row.catalogId),
  );
  return rows.map((row) => ({ ...row, listItems: index.get(row.catalogId) ?? [] }));
};

/** The catalog row behind one of the user's own titles, or null when it is not theirs. */
export const catalogIdOfOwnTitle = async (userId: string, titleId: string) => {
  const row = await db.query.titles.findFirst({
    where: and(eq(titles.id, titleId), eq(titles.userId, userId)),
    columns: { catalogId: true },
  });
  return row?.catalogId ?? null;
};

/** titleId → catalogId for the user's own titles; ids that are not theirs are left out. */
export const catalogIdsOfOwnTitles = async (userId: string, titleIds: readonly string[]) => {
  const unique = [...new Set(titleIds)];
  if (unique.length === 0) {
    return new Map<string, string>();
  }
  const rows = await db
    .select({ id: titles.id, catalogId: titles.catalogId })
    .from(titles)
    .where(and(eq(titles.userId, userId), inArray(titles.id, unique)));
  return new Map(rows.map((row) => [row.id, row.catalogId]));
};

/**
 * The catalog row of a Title as a subquery, for writes that only hold a titleId
 * the caller already checked: `eq(listItems.catalogId, catalogIdOfTitle(id))`.
 */
export const catalogIdOfTitle = (titleId: string) =>
  sql<string>`(select "catalogId" from "Title" where "id" = ${titleId})`;

/**
 * Deleting your own entry used to cascade its list items. It still clears the
 * film from your own lists where you added it, but never what someone else
 * added to a list you share, nor what you added to someone else's list.
 */
export const deleteOwnListItemsOfTitle = (userId: string, titleId: string) =>
  db
    .delete(listItems)
    .where(
      and(
        eq(listItems.catalogId, catalogIdOfTitle(titleId)),
        inArray(
          listItems.listId,
          db.select({ id: lists.id }).from(lists).where(eq(lists.userId, userId)),
        ),
        or(eq(listItems.addedByUserId, userId), isNull(listItems.addedByUserId)),
      ),
    );
