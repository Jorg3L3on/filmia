import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { db, listItems, lists, titles, type Platform, type SeriesStatus } from "@/db";
import { upsertTitleFromTmdbForUser } from "@/lib/add-title-from-tmdb";
import { isValidIsoDate, isoDateToUtcNoon, toDateInput } from "@/lib/dates";
import { DomainError } from "@/lib/domain-error";
import { catalogIdOfOwnTitle, catalogIdOfTitle } from "@/lib/list-items";
import { ensureDefaultLists, ensureSeriesStatusList, SERIES_STATUS_LIST_SLUGS, WATCHLIST_SLUG } from "@/lib/lists";
import {
  revalidateDiarySurfaces,
  revalidateListMembership,
  revalidateRatingSurfaces,
  revalidateSeriesSurfaces,
  revalidateWatchlistSurfaces,
} from "@/lib/revalidate-surfaces";
import { VISTE_RATING } from "@/lib/piezas/core";
import { seriesStatusListTransition } from "@/lib/series-status-lists";
import { scheduleTonightRecompute } from "@/lib/tonight-store";
import { revalidatePath } from "next/cache";

/**
 * A person's writes on their own titles (FIL-I20-5): Quiero ver, vista, calificación, estado de
 * serie. The Server Actions and the MCP tools both call these, so both revalidate the same
 * surfaces and recompute Hoy the same way.
 */

/** revalidatePath only works inside a Next request; scripts and tests have none. */
const revalidate = (run: () => void) => {
  try {
    run();
  } catch {
    // Outside a request scope: nothing is cached to invalidate.
  }
};

export const ensureWatchlistFor = async (userId: string) => {
  await ensureDefaultLists(userId);
  const watchlist = await db.query.lists.findFirst({
    where: and(eq(lists.userId, userId), eq(lists.slug, WATCHLIST_SLUG)),
  });
  if (!watchlist) throw new Error("No se pudo crear Quiero ver.");
  return watchlist;
};

/** Adds one of the person's titles to the end of Quiero ver; a note updates an existing entry. */
export const addToWatchlistFor = async (userId: string, titleId: string, queueNote?: string) => {
  const watchlist = await ensureWatchlistFor(userId);
  const catalogId = await catalogIdOfOwnTitle(userId, titleId);
  if (!catalogId) throw new DomainError("not_found", "Título no encontrado.");

  const last = await db.query.listItems.findFirst({
    where: eq(listItems.listId, watchlist.id),
    orderBy: [desc(listItems.position)],
  });
  const note = queueNote?.trim() || null;
  const values = {
    listId: watchlist.id,
    catalogId,
    addedByUserId: userId,
    position: (last?.position ?? -1) + 1,
    queueNote: note,
  };
  // Drizzle throws "No values to set" if onConflictDoUpdate gets `set: {}`.
  const inserted = note
    ? await db
        .insert(listItems)
        .values(values)
        .onConflictDoUpdate({ target: [listItems.listId, listItems.catalogId], set: { queueNote: note } })
        .returning({ listId: listItems.listId })
    : await db.insert(listItems).values(values).onConflictDoNothing().returning({ listId: listItems.listId });

  revalidate(() => {
    revalidateWatchlistSurfaces(titleId);
    revalidatePath("/");
  });
  scheduleTonightRecompute(userId);
  return { catalogId, added: inserted.length > 0 };
};

export const removeFromWatchlistFor = async (userId: string, titleId: string) => {
  const watchlist = await db.query.lists.findFirst({
    where: and(eq(lists.userId, userId), eq(lists.slug, WATCHLIST_SLUG)),
    columns: { id: true },
  });
  if (!watchlist) return;
  await db
    .delete(listItems)
    .where(and(eq(listItems.listId, watchlist.id), eq(listItems.catalogId, catalogIdOfTitle(titleId))));
  revalidate(() => {
    revalidateWatchlistSurfaces(titleId);
    revalidatePath("/");
  });
  scheduleTonightRecompute(userId);
};

export type MarkWatchedInput = {
  /** Stored at noon UTC of the day, like every diary date. */
  watchedAt: Date;
  /** 1–10; undefined leaves it, null clears it. */
  rating?: number | null;
  review?: string | null;
  platform?: Platform | null;
};

/** Marks a title watched on a day and takes it out of Quiero ver. */
export const markWatchedFor = async (userId: string, titleId: string, input: MarkWatchedInput) => {
  const title = await db.query.titles.findFirst({
    where: and(eq(titles.id, titleId), eq(titles.userId, userId)),
    columns: { id: true },
  });
  if (!title) throw new DomainError("not_found", "Título no encontrado.");

  const watchlist = await db.query.lists.findFirst({
    where: and(eq(lists.userId, userId), eq(lists.slug, WATCHLIST_SLUG)),
    columns: { id: true },
  });
  const updateTitle = db
    .update(titles)
    .set({
      watchedAt: input.watchedAt,
      ...(input.rating !== undefined ? { rating: input.rating } : {}),
      ...(input.review !== undefined ? { review: input.review } : {}),
      ...(input.platform !== undefined ? { platform: input.platform } : {}),
    })
    .where(eq(titles.id, titleId));

  if (!watchlist) {
    await updateTitle;
  } else {
    await db.batch([
      updateTitle,
      db
        .delete(listItems)
        .where(and(eq(listItems.listId, watchlist.id), eq(listItems.catalogId, catalogIdOfTitle(titleId)))),
    ]);
  }

  revalidate(() => revalidateDiarySurfaces(titleId));
  scheduleTonightRecompute(userId);
};

/**
 * Puts a cleared diary date back. Only when `watchedAt` is still null, so a date the
 * person logged during the undo window is left alone. Does not touch rating, review,
 * platform, or Quiero ver (unlike `markWatchedFor`).
 */
export const restoreWatchedFor = async (userId: string, titleId: string, isoDate: string) => {
  if (!isValidIsoDate(isoDate)) {
    throw new DomainError("validation", "La fecha vista no es válida.");
  }
  const updated = await db
    .update(titles)
    .set({ watchedAt: isoDateToUtcNoon(isoDate) })
    .where(and(eq(titles.id, titleId), eq(titles.userId, userId), isNull(titles.watchedAt)))
    .returning({ watchedAt: titles.watchedAt });
  const watchedAt = updated[0]?.watchedAt;
  if (!watchedAt) {
    throw new DomainError("not_found", "Título no encontrado.");
  }
  revalidate(() => revalidateDiarySurfaces(titleId));
  scheduleTonightRecompute(userId);
  return toDateInput(watchedAt);
};

/** Sets (or clears, with null) the rating; `review` is only touched when given. */
export const setRatingFor = async (
  userId: string,
  titleId: string,
  input: { rating: number | null; review?: string | null },
) => {
  const updated = await db
    .update(titles)
    .set({ rating: input.rating, ...(input.review !== undefined ? { review: input.review } : {}) })
    .where(and(eq(titles.id, titleId), eq(titles.userId, userId)))
    .returning({ id: titles.id });
  if (updated.length === 0) throw new DomainError("not_found", "Título no encontrado.");
  revalidate(() => revalidateRatingSurfaces(titleId));
  scheduleTonightRecompute(userId);
};

export type QuickRateAnswer = keyof typeof VISTE_RATING;

/**
 * FIL-28 · «Me gustó / No tanto» in the «Añadida a tu diario» toast: the engine's implied rating
 * (8 / 4), written only while the person has no stars of their own (`rating IS NULL`). Returns the
 * implied rating it replaced, so Deshacer can put it back; `written: false` when stars exist.
 */
export const setImpliedRatingFor = async (userId: string, titleOrCatalogId: string, answer: QuickRateAnswer) => {
  // Hoy's recommendations know their catalog id until «Vi esto» creates the Title.
  const current = await db.query.titles.findFirst({
    where: and(eq(titles.userId, userId), or(eq(titles.id, titleOrCatalogId), eq(titles.catalogId, titleOrCatalogId))),
    columns: { id: true, rating: true, impliedRating: true },
  });
  if (!current) throw new DomainError("not_found", "Título no encontrado.");
  const titleId = current.id;
  const owned = and(eq(titles.id, titleId), eq(titles.userId, userId));
  if (current.rating != null) {
    return { written: false, previous: current.impliedRating };
  }
  const updated = await db
    .update(titles)
    .set({ impliedRating: VISTE_RATING[answer] })
    .where(and(owned, isNull(titles.rating)))
    .returning({ id: titles.id });
  if (updated.length === 0) {
    return { written: false, previous: current.impliedRating };
  }
  revalidate(() => revalidateRatingSurfaces(titleId));
  scheduleTonightRecompute(userId);
  return { written: true, previous: current.impliedRating, titleId };
};

/** Deshacer of the quick answer: back to what `setImpliedRatingFor` replaced, still only without stars. */
export const restoreImpliedRatingFor = async (userId: string, titleId: string, previous: number | null) => {
  // Always the Title id `setImpliedRatingFor` returned.
  await db
    .update(titles)
    .set({ impliedRating: previous })
    .where(and(eq(titles.id, titleId), eq(titles.userId, userId), isNull(titles.rating)));
  revalidate(() => revalidateRatingSurfaces(titleId));
  scheduleTonightRecompute(userId);
};

const ownedSeries = async (userId: string, titleId: string) => {
  const title = await db.query.titles.findFirst({
    where: and(eq(titles.id, titleId), eq(titles.userId, userId)),
    columns: { id: true, catalogId: true, seriesStatus: true },
    with: { catalog: { columns: { kind: true } } },
  });
  if (!title) throw new DomainError("not_found", "Título no encontrado.");
  if (title.catalog.kind !== "SERIES") {
    throw new DomainError("validation", "El estado de seguimiento solo aplica a series.");
  }
  return title;
};

/**
 * Viendo → «Series en progreso», Abandonada → «Series abandonadas». Terminada o sin estado:
 * fuera de ambas. La lista destino se crea la primera vez.
 */
export const setSeriesStatusFor = async (userId: string, titleId: string, nextStatus: SeriesStatus | null) => {
  const { catalogId, seriesStatus: previousStatus } = await ownedSeries(userId, titleId);
  const transition = seriesStatusListTransition(previousStatus, nextStatus);
  const statusLists = await db.query.lists.findMany({
    where: and(eq(lists.userId, userId), inArray(lists.slug, [...SERIES_STATUS_LIST_SLUGS])),
    columns: { id: true, slug: true },
  });
  const joinListId = transition.join
    ? (statusLists.find((list) => list.slug === transition.join)?.id ??
      (await ensureSeriesStatusList(userId, transition.join)))
    : null;
  const leaveListIds = statusLists
    .filter((list) => list.slug && transition.leave.some((slug) => slug === list.slug))
    .map((list) => list.id);
  const lastItem = joinListId
    ? await db.query.listItems.findFirst({
        where: eq(listItems.listId, joinListId),
        orderBy: [desc(listItems.position)],
        columns: { position: true },
      })
    : undefined;

  await db.batch([
    db
      .update(titles)
      .set({ seriesStatus: nextStatus, ...(nextStatus == null ? { seriesSeason: null } : {}) })
      .where(eq(titles.id, titleId)),
    ...(leaveListIds.length > 0
      ? [
          db
            .delete(listItems)
            .where(and(eq(listItems.catalogId, catalogIdOfTitle(titleId)), inArray(listItems.listId, leaveListIds))),
        ]
      : []),
    ...(joinListId
      ? [
          db
            .insert(listItems)
            .values({ listId: joinListId, catalogId, addedByUserId: userId, position: (lastItem?.position ?? -1) + 1 })
            .onConflictDoNothing(),
        ]
      : []),
  ]);

  revalidate(() => {
    revalidateSeriesSurfaces(titleId);
    for (const listId of [joinListId, ...leaveListIds]) {
      if (listId) revalidateListMembership(listId, titleId);
    }
  });
};

export { ownedSeries };

/**
 * The person's Title for a catalog film, creating it (no state) when they never saved it, the
 * way Buscar saves a TMDB result.
 */
export const ensureOwnTitleFor = async (
  userId: string,
  film: { tmdbId: number; kind: "MOVIE" | "SERIES"; name: string; originalName?: string | null; year?: number | null; posterPath?: string | null },
) => {
  const result = await upsertTitleFromTmdbForUser(userId, {
    tmdbId: film.tmdbId,
    kind: film.kind,
    name: film.name,
    originalName: film.originalName ?? undefined,
    year: film.year ?? undefined,
    posterPath: film.posterPath ?? undefined,
  });
  if (!result.ok) throw new DomainError("validation", result.error);
  return { titleId: result.titleId, created: result.created };
};
