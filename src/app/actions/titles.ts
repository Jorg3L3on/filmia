"use server";

import { and, desc, eq, inArray } from "drizzle-orm";
import { db, listItems, lists, titles, type SeriesStatus } from "@/db";
import {
  parseOptionalReview,
  parseRating,
  parseSeriesSeason,
} from "@/lib/form-data";
import {
  upsertTitleFromTmdbForUser,
  type AddTitleFromTmdbInput,
  type AddTitleFromTmdbResult,
} from "@/lib/add-title-from-tmdb";
import { catalogIdFor, findOrCreateCatalog } from "@/lib/catalog";
import { scheduleCatalogEnrichment } from "@/lib/catalog-enrich";
import { SERIES_STATUSES } from "@/lib/labels";
import { ensureSeriesStatusList, SERIES_STATUS_LIST_SLUGS } from "@/lib/lists";
import { parseRelinkPick, planRelink } from "@/lib/relink-core";
import { seriesStatusListTransition } from "@/lib/series-status-lists";
import {
  revalidateDiarySurfaces,
  revalidateListMembership,
  revalidateRatingSurfaces,
  revalidateSearchAddSurfaces,
  revalidateSeriesSurfaces,
} from "@/lib/revalidate-surfaces";
import { requireUserId } from "@/lib/session";
import { scheduleTonightRecompute } from "@/lib/tonight-store";

export type { AddTitleFromTmdbInput, AddTitleFromTmdbResult };

// Titles only enter Filmia from TMDB (`addTitleFromTmdb`); the catalog data is
// never edited by users and a title is never deleted — only its personal
// fields (rating, review, platform, watchedAt, series status) change, and the
// entry can be pointed at a different TMDB match (`relinkTitle`).

export type RelinkTitleResult =
  | { ok: true; changed: boolean }
  | { ok: false; error: string; existingTitleId?: string };

/**
 * «¿No es esta?»: move the user's entry to another TMDB match. Only
 * `Title.catalogId` changes — rating, review, platform, watched date, series
 * progress and list membership stay put, and no catalog row is ever edited.
 */
export const relinkTitle = async (
  titleId: string,
  input: unknown,
): Promise<RelinkTitleResult> => {
  const userId = await requireUserId();
  const pick = parseRelinkPick(input);
  if (!pick) {
    return { ok: false, error: "Ese resultado de TMDB no es válido." };
  }

  const title = await db.query.titles.findFirst({
    where: and(eq(titles.id, titleId), eq(titles.userId, userId)),
    columns: { id: true, catalogId: true },
    with: { catalog: { columns: { kind: true } } },
  });
  if (!title) {
    return { ok: false, error: "Título no encontrado." };
  }
  if (title.catalog.kind !== pick.kind) {
    return { ok: false, error: "Elige un título del mismo tipo (película o serie)." };
  }

  const targetCatalogId = catalogIdFor(pick.kind, pick.tmdbId);
  const owned = await db.query.titles.findFirst({
    where: and(eq(titles.userId, userId), eq(titles.catalogId, targetCatalogId)),
    columns: { id: true },
  });
  const plan = planRelink({
    titleId,
    currentCatalogId: title.catalogId,
    targetCatalogId,
    ownedTitleIdForTarget: owned?.id ?? null,
  });

  if (plan.kind === "same") {
    return { ok: true, changed: false };
  }
  if (plan.kind === "duplicate") {
    return {
      ok: false,
      error: `Ya tienes «${pick.name}» en tu Filmia.`,
      existingTitleId: plan.titleId,
    };
  }

  const { row: film, created } = await findOrCreateCatalog(pick);
  await db
    .update(titles)
    .set({ catalogId: film.id })
    .where(and(eq(titles.id, titleId), eq(titles.userId, userId)));

  if (created) {
    scheduleCatalogEnrichment(film, { userId, titleId });
  } else {
    scheduleTonightRecompute(userId);
  }
  revalidateDiarySurfaces(titleId);
  revalidateSeriesSurfaces(titleId);

  return { ok: true, changed: true };
};

export const addTitleFromTmdb = async (
  input: AddTitleFromTmdbInput,
): Promise<AddTitleFromTmdbResult> => {
  const userId = await requireUserId();
  const result = await upsertTitleFromTmdbForUser(userId, input);

  if (result.ok) {
    revalidateSearchAddSurfaces(result.titleId, {
      watchlist: result.addedToWatchlist,
      watched: result.markedWatched,
    });
  }

  return result;
};

const requireOwnedSeries = async (titleId: string) => {
  const userId = await requireUserId();
  const title = await db.query.titles.findFirst({
    where: and(eq(titles.id, titleId), eq(titles.userId, userId)),
    columns: { id: true, seriesStatus: true },
    with: { catalog: { columns: { kind: true } } },
  });

  if (!title) {
    throw new Error("Título no encontrado.");
  }

  if (title.catalog.kind !== "SERIES") {
    throw new Error("El estado de seguimiento solo aplica a series.");
  }

  return { id: title.id, seriesStatus: title.seriesStatus, userId };
};

export const setTitleRating = async (titleId: string, formData: FormData) => {
  const userId = await requireUserId();
  const rating = parseRating(formData.get("rating"));
  const review = parseOptionalReview(formData.get("review"));

  const updated = await db
    .update(titles)
    .set({
      rating,
      ...(formData.has("review") ? { review } : {}),
    })
    .where(and(eq(titles.id, titleId), eq(titles.userId, userId)))
    .returning({ id: titles.id });

  if (updated.length === 0) {
    throw new Error("Título no encontrado.");
  }

  revalidateRatingSurfaces(titleId);
  scheduleTonightRecompute(userId);
};

export const setSeriesStatus = async (
  titleId: string,
  status: SeriesStatus | "NONE",
) => {
  const { userId, seriesStatus: previousStatus } = await requireOwnedSeries(titleId);

  const nextStatus =
    status === "NONE"
      ? null
      : SERIES_STATUSES.includes(status)
        ? status
        : null;

  if (status !== "NONE" && nextStatus == null) {
    throw new Error("El estado de la serie no es válido.");
  }

  // Viendo → «Series en progreso», Abandonada → «Series abandonadas». Terminada
  // o sin estado: fuera de ambas. La lista destino se crea la primera vez.
  const transition = seriesStatusListTransition(previousStatus, nextStatus);
  const statusLists = await db.query.lists.findMany({
    where: and(
      eq(lists.userId, userId),
      inArray(lists.slug, [...SERIES_STATUS_LIST_SLUGS]),
    ),
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
      .set({
        seriesStatus: nextStatus,
        ...(nextStatus == null ? { seriesSeason: null } : {}),
      })
      .where(eq(titles.id, titleId)),
    ...(leaveListIds.length > 0
      ? [
          db
            .delete(listItems)
            .where(
              and(
                eq(listItems.titleId, titleId),
                inArray(listItems.listId, leaveListIds),
              ),
            ),
        ]
      : []),
    ...(joinListId
      ? [
          db
            .insert(listItems)
            .values({
              listId: joinListId,
              titleId,
              position: (lastItem?.position ?? -1) + 1,
            })
            .onConflictDoNothing(),
        ]
      : []),
  ]);

  revalidateSeriesSurfaces(titleId);
  for (const listId of [joinListId, ...leaveListIds]) {
    if (listId) {
      revalidateListMembership(listId, titleId);
    }
  }
};

export const setSeriesSeason = async (titleId: string, formData: FormData) => {
  await requireOwnedSeries(titleId);
  const seriesSeason = parseSeriesSeason(formData.get("seriesSeason"));

  await db.update(titles).set({ seriesSeason }).where(eq(titles.id, titleId));

  revalidateSeriesSurfaces(titleId);
};
