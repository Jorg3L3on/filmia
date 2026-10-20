"use server";

import { and, eq } from "drizzle-orm";
import { db, titles, type SeriesStatus } from "@/db";
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
import { parseRelinkPick, planRelink } from "@/lib/relink-core";
import {
  revalidateDiarySurfaces,
  revalidateSearchAddSurfaces,
  revalidateSeriesSurfaces,
} from "@/lib/revalidate-surfaces";
import { requireUserId } from "@/lib/session";
import { scheduleTonightRecompute } from "@/lib/tonight-store";
import { ownedSeries, setRatingFor, setSeriesStatusFor } from "@/lib/title-writes";

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

const requireOwnedSeries = async (titleId: string) => ownedSeries(await requireUserId(), titleId);

export const setTitleRating = async (titleId: string, formData: FormData) => {
  const userId = await requireUserId();
  const rating = parseRating(formData.get("rating"));
  const review = parseOptionalReview(formData.get("review"));

  await setRatingFor(userId, titleId, { rating, ...(formData.has("review") ? { review } : {}) });
};

export const setSeriesStatus = async (
  titleId: string,
  status: SeriesStatus | "NONE",
) => {
  const userId = await requireUserId();
  const nextStatus =
    status === "NONE"
      ? null
      : SERIES_STATUSES.includes(status)
        ? status
        : null;

  if (status !== "NONE" && nextStatus == null) {
    throw new Error("El estado de la serie no es válido.");
  }

  await setSeriesStatusFor(userId, titleId, nextStatus);
};

export const setSeriesSeason = async (titleId: string, formData: FormData) => {
  await requireOwnedSeries(titleId);
  const seriesSeason = parseSeriesSeason(formData.get("seriesSeason"));

  await db.update(titles).set({ seriesSeason }).where(eq(titles.id, titleId));

  revalidateSeriesSurfaces(titleId);
};
