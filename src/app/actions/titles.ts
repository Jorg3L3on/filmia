"use server";

import { createId } from "@paralleldrive/cuid2";
import { and, desc, eq, inArray, notInArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import {
  db,
  listItems,
  lists,
  titles,
  type SeriesStatus,
  type TitleKind,
} from "@/db";
import {
  parseIdList,
  parseOptionalDate,
  parseOptionalReview,
  parsePlatform,
  parseRating,
  parseRequiredName,
  parseSeriesSeason,
  parseTitleKind,
  parseYear,
} from "@/lib/form-data";
import {
  upsertTitleFromTmdbForUser,
  type AddTitleFromTmdbInput,
  type AddTitleFromTmdbResult,
} from "@/lib/add-title-from-tmdb";
import { SERIES_STATUSES } from "@/lib/labels";
import {
  ensureSeriesStatusList,
  isSeriesStatusListSlug,
  SERIES_STATUS_LIST_SLUGS,
} from "@/lib/lists";
import { seriesStatusListTransition } from "@/lib/series-status-lists";
import { scheduleAfterResponse } from "@/lib/after-response";
import {
  enrichMetadataOnSave,
  readMetadataFields,
  type TitleMetadata,
} from "@/lib/metadata";
import {
  revalidateCatalogSurfaces,
  revalidateListMembership,
  revalidateRatingSurfaces,
  revalidateSearchAddSurfaces,
  revalidateSeriesSurfaces,
  revalidateTitlePages,
} from "@/lib/revalidate-surfaces";
import { requireUserId } from "@/lib/session";
import { scheduleTonightRecompute } from "@/lib/tonight-store";
import { enrichWatchProvidersOnSave } from "@/lib/watch-providers-cache";

export type { AddTitleFromTmdbInput, AddTitleFromTmdbResult };

const revalidateCatalog = (titleId?: string) => {
  revalidateCatalogSurfaces(titleId);
};

const seriesProgressData = (kind: TitleKind) =>
  kind === "SERIES" ? {} : { seriesStatus: null, seriesSeason: null };

const syncLists = async (
  userId: string,
  titleId: string,
  listIds: string[],
  kind: TitleKind,
) => {
  const allCollectionLists = await db.query.lists.findMany({
    where: and(eq(lists.userId, userId), eq(lists.kind, "COLLECTION")),
    columns: { id: true, slug: true },
  });
  // Las listas por estado de serie las gobierna el estado, no el formulario.
  const collectionLists = allCollectionLists.filter(
    (list) => !isSeriesStatusListSlug(list.slug),
  );
  const collectionIds = collectionLists.map((list) => list.id);
  const collectionSet = new Set(collectionIds);
  const seriesStatusListIds = allCollectionLists
    .filter((list) => isSeriesStatusListSlug(list.slug))
    .map((list) => list.id);

  if (kind !== "SERIES" && seriesStatusListIds.length > 0) {
    // Dejó de ser serie: pierde el estado y, con él, las listas por estado.
    await db
      .delete(listItems)
      .where(
        and(
          eq(listItems.titleId, titleId),
          inArray(listItems.listId, seriesStatusListIds),
        ),
      );
  }

  if (collectionIds.length > 0) {
    await db
      .delete(listItems)
      .where(
        and(
          eq(listItems.titleId, titleId),
          inArray(listItems.listId, collectionIds),
          listIds.length > 0 ? notInArray(listItems.listId, listIds) : undefined,
        ),
      );
  }

  // Reuse the collection id set — no per-list findFirst (N+1 on ficha save).
  const ownedSelected = listIds.filter((listId) => collectionSet.has(listId));
  if (ownedSelected.length === 0) {
    return;
  }

  await db
    .insert(listItems)
    .values(
      ownedSelected.map((listId, index) => ({
        listId,
        titleId,
        position: index,
      })),
    )
    .onConflictDoNothing();
};

const readTitleFields = (formData: FormData) => ({
  name: parseRequiredName(formData.get("name")),
  originalName: String(formData.get("originalName") ?? "").trim() || null,
  kind: parseTitleKind(formData.get("kind")),
  year: parseYear(formData.get("year")),
  rating: parseRating(formData.get("rating")),
  review: parseOptionalReview(formData.get("review")),
  platform: parsePlatform(formData.get("platform")),
  watchedAt: parseOptionalDate(formData.get("watchedAt")),
  listIds: parseIdList(formData, "listIds"),
});

const scheduleTitleEnrichment = (
  titleId: string,
  snapshot: TitleMetadata,
  kind: TitleKind,
) => {
  if (!snapshot.tmdbId) {
    return;
  }

  scheduleAfterResponse(async () => {
    try {
      const [resolved] = await Promise.all([
        enrichMetadataOnSave(snapshot, kind),
        enrichWatchProvidersOnSave(titleId, snapshot.tmdbId!, kind),
      ]);

      await db
        .update(titles)
        .set({
          tmdbId: resolved.tmdbId ?? snapshot.tmdbId,
          posterPath: resolved.posterPath ?? snapshot.posterPath,
          backdropPath: resolved.backdropPath ?? snapshot.backdropPath,
          runtimeMinutes: resolved.runtimeMinutes ?? snapshot.runtimeMinutes,
          imdbId: resolved.imdbId ?? snapshot.imdbId,
          imdbRating: resolved.imdbRating ?? snapshot.imdbRating,
          awards: resolved.awards ?? undefined,
          overview: resolved.overview ?? undefined,
          tmdbGenres: resolved.tmdbGenres,
        })
        .where(eq(titles.id, titleId));

      revalidateTitlePages(titleId);
    } catch {
      // Snapshot row already exists; enrichment is best-effort.
    }
  });
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

export const createTitle = async (formData: FormData) => {
  const userId = await requireUserId();
  const fields = readTitleFields(formData);
  const snapshot = readMetadataFields(formData);

  const titleId = createId();
  const now = new Date();
  await db.insert(titles).values({
    id: titleId,
    userId,
    name: fields.name,
    originalName: fields.originalName,
    kind: fields.kind,
    year: fields.year,
    rating: fields.rating,
    review: fields.review,
    platform: fields.platform,
    watchedAt: fields.watchedAt,
    tmdbId: snapshot.tmdbId,
    posterPath: snapshot.posterPath,
    imdbId: snapshot.imdbId,
    imdbRating: snapshot.imdbRating,
    overview: null,
    tmdbGenres: snapshot.tmdbGenres,
    createdAt: now,
    updatedAt: now,
    ...seriesProgressData(fields.kind),
  });

  await syncLists(userId, titleId, fields.listIds, fields.kind);
  scheduleTitleEnrichment(titleId, snapshot, fields.kind);
  revalidateCatalog(titleId);
  redirect(`/titulos/${titleId}`);
};

export const updateTitle = async (titleId: string, formData: FormData) => {
  const userId = await requireUserId();
  const fields = readTitleFields(formData);
  const snapshot = readMetadataFields(formData);

  const existing = await db.query.titles.findFirst({
    where: and(eq(titles.id, titleId), eq(titles.userId, userId)),
    columns: {
      id: true,
      overview: true,
      tmdbGenres: true,
      imdbId: true,
      imdbRating: true,
      posterPath: true,
      tmdbId: true,
    },
  });

  if (!existing) {
    throw new Error("Título no encontrado.");
  }

  await db
    .update(titles)
    .set({
      name: fields.name,
      originalName: fields.originalName,
      kind: fields.kind,
      year: fields.year,
      rating: fields.rating,
      review: fields.review,
      platform: fields.platform,
      watchedAt: fields.watchedAt,
      tmdbId: snapshot.tmdbId ?? existing.tmdbId,
      posterPath: snapshot.posterPath ?? existing.posterPath,
      imdbId: snapshot.imdbId ?? existing.imdbId,
      imdbRating: snapshot.imdbRating ?? existing.imdbRating,
      overview: existing.overview ?? undefined,
      tmdbGenres: existing.tmdbGenres,
      ...seriesProgressData(fields.kind),
    })
    .where(eq(titles.id, titleId));

  await syncLists(userId, titleId, fields.listIds, fields.kind);
  scheduleTitleEnrichment(
    titleId,
    {
      ...snapshot,
      tmdbId: snapshot.tmdbId ?? existing.tmdbId,
      posterPath: snapshot.posterPath ?? existing.posterPath,
      imdbId: snapshot.imdbId ?? existing.imdbId,
      imdbRating: snapshot.imdbRating ?? existing.imdbRating,
    },
    fields.kind,
  );
  revalidateCatalog(titleId);
  redirect(`/titulos/${titleId}`);
};

export const deleteTitle = async (titleId: string) => {
  const userId = await requireUserId();

  const deleted = await db
    .delete(titles)
    .where(and(eq(titles.id, titleId), eq(titles.userId, userId)))
    .returning({ id: titles.id });

  if (deleted.length === 0) {
    throw new Error("Título no encontrado.");
  }

  revalidateCatalog(titleId);
  redirect("/");
};

const requireOwnedSeries = async (titleId: string) => {
  const userId = await requireUserId();
  const title = await db.query.titles.findFirst({
    where: and(eq(titles.id, titleId), eq(titles.userId, userId)),
    columns: { id: true, kind: true, seriesStatus: true },
  });

  if (!title) {
    throw new Error("Título no encontrado.");
  }

  if (title.kind !== "SERIES") {
    throw new Error("El estado de seguimiento solo aplica a series.");
  }

  return { ...title, userId };
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
