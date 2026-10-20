import { createId } from "@paralleldrive/cuid2";
import { and, desc, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, listItems, lists } from "@/db";
import { DomainError } from "@/lib/domain-error";
import { parseRequiredName } from "@/lib/form-data";
import { canOnList, type ListAction } from "@/lib/list-access-core";
import { LIST_FORBIDDEN, LIST_NOT_FOUND, listAccessFor } from "@/lib/list-access";
import { catalogIdOfOwnTitle, catalogIdsOfOwnTitles } from "@/lib/list-items";
import { hasDuplicateListName, isRenameBlocked, LIST_NAME_TAKEN_MESSAGE } from "@/lib/list-names";
import { isReservedListSlug, isSeriesStatusListSlug, WATCHLIST_SLUG } from "@/lib/lists";
import { slugify } from "@/lib/labels";
import { scheduleTonightRecompute } from "@/lib/tonight-store";

/**
 * List writes shared by the Server Actions and the MCP tools (FIL-I20-5): same access rules
 * (FIL-I18 roles), same name rules, same revalidation.
 */

export const SERIES_LIST_AUTOMATIC = "Esta lista se actualiza sola con el estado de la serie.";
export const YEAR_TOP_FROM_CINE = "Tu top del año se arma desde Cine.";

/** The access, or DomainError not_found / forbidden (same messages as the UI). */
export const listAccessOrThrow = async (userId: string, listId: string, action: ListAction) => {
  const access = await listAccessFor(listId, userId);
  if (!access) throw new DomainError("not_found", LIST_NOT_FOUND);
  if (!canOnList(access.role, action)) throw new DomainError("forbidden", LIST_FORBIDDEN);
  return access;
};

const revalidate = (run: () => void) => {
  try {
    run();
  } catch {
    // Outside a request scope: nothing to invalidate.
  }
};

export const revalidateLists = (listId?: string, titleId?: string, slug?: string | null) =>
  revalidate(() => {
    revalidatePath("/listas");
    if (slug === WATCHLIST_SLUG) revalidatePath("/watchlist");
    if (listId) {
      revalidatePath(`/listas/${listId}`);
      revalidatePath(`/listas/${listId}/editar`);
    }
    if (titleId) revalidatePath(`/titulos/${titleId}`);
  });

/**
 * Error de nombre para una lista propia: choque con otra lista del usuario (diarias incluidas,
 * comparando con `slugify`) o nombre reservado.
 */
export const userListNameError = async (userId: string, name: string, current?: { id: string; name: string }) => {
  const existing = await db.query.lists.findMany({
    where: eq(lists.userId, userId),
    columns: { id: true, name: true },
  });
  const taken = current ? isRenameBlocked(name, existing, current) : hasDuplicateListName(name, existing);
  if (taken) return LIST_NAME_TAKEN_MESSAGE;
  if (isReservedListSlug(slugify(name))) return "Ese nombre está reservado para una lista diaria.";
  return null;
};

export const parseListName = (value: unknown): { name: string } | { error: string } => {
  try {
    return { name: parseRequiredName(typeof value === "string" ? value : null) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Datos no válidos." };
  }
};

/** A new COLLECTION list of the person; name errors are DomainError validation. */
export const createListFor = async (userId: string, input: { name: string; description?: string | null }) => {
  const parsed = parseListName(input.name);
  if ("error" in parsed) throw new DomainError("validation", parsed.error);
  const nameError = await userListNameError(userId, parsed.name);
  if (nameError) throw new DomainError("validation", nameError);

  const listId = createId();
  const now = new Date();
  await db.insert(lists).values({
    id: listId,
    userId,
    name: parsed.name,
    description: input.description?.trim() || null,
    kind: "COLLECTION",
    createdAt: now,
    updatedAt: now,
  });
  revalidateLists(listId);
  return { listId, name: parsed.name };
};

/** Adds one of the person's own titles to the end of a list they may edit. */
export const addTitleToListFor = async (userId: string, listId: string, titleId: string) => {
  const { list } = await listAccessOrThrow(userId, listId, "edit_items");
  if (isSeriesStatusListSlug(list.slug)) throw new DomainError("validation", SERIES_LIST_AUTOMATIC);
  if (list.kind === "YEAR_TOP") throw new DomainError("validation", YEAR_TOP_FROM_CINE);

  const catalogId = await catalogIdOfOwnTitle(userId, titleId);
  if (!catalogId) throw new DomainError("not_found", "Título no encontrado.");

  const last = await db.query.listItems.findFirst({
    where: eq(listItems.listId, listId),
    orderBy: [desc(listItems.position)],
  });
  const inserted = await db
    .insert(listItems)
    .values({ listId, catalogId, addedByUserId: userId, position: (last?.position ?? -1) + 1 })
    .onConflictDoNothing()
    .returning({ listId: listItems.listId });

  revalidateLists(listId, titleId, list.slug);
  scheduleTonightRecompute(userId);
  return { list, catalogId, added: inserted.length > 0 };
};

/**
 * A film on a list is named by the caller's own title id or, for films they never saved
 * (shared lists), by the catalog id already on that list.
 */
export const resolveListItemCatalogIds = async (userId: string, listId: string, ids: readonly string[]) => {
  const own = await catalogIdsOfOwnTitles(userId, ids);
  const rest = ids.filter((id) => !own.has(id));
  const onList =
    rest.length > 0
      ? await db
          .select({ catalogId: listItems.catalogId })
          .from(listItems)
          .where(and(eq(listItems.listId, listId), inArray(listItems.catalogId, rest)))
      : [];
  const listed = new Set(onList.map((row) => row.catalogId));
  return new Map(
    ids.flatMap((id) => {
      const catalogId = own.get(id) ?? (listed.has(id) ? id : undefined);
      return catalogId ? [[id, catalogId] as const] : [];
    }),
  );
};

/** `id`: the person's own title id, or the catalog id of a film someone else added. */
export const removeFromListFor = async (userId: string, listId: string, id: string) => {
  const { list } = await listAccessOrThrow(userId, listId, "edit_items");
  if (isSeriesStatusListSlug(list.slug)) throw new DomainError("validation", SERIES_LIST_AUTOMATIC);

  const catalogId = (await resolveListItemCatalogIds(userId, listId, [id])).get(id);
  const removed = catalogId
    ? await db
        .delete(listItems)
        .where(and(eq(listItems.listId, listId), eq(listItems.catalogId, catalogId)))
        .returning({ listId: listItems.listId })
    : [];
  revalidateLists(listId, id, list.slug);
  scheduleTonightRecompute(userId);
  return { list, removed: removed.length > 0 };
};
