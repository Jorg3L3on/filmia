import { createId } from "@paralleldrive/cuid2";
import { and, asc, eq, inArray, isNotNull, or, sql } from "drizzle-orm";
import { catalog, db, listItems, lists, pickEvents, serviceCharts, titles, type Platform } from "@/db";
import { upsertTitleFromTmdbForUser } from "@/lib/add-title-from-tmdb";
import { scheduleAfterResponse } from "@/lib/after-response";
import { WATCHLIST_SLUG } from "@/lib/lists";
import { VISTE_RATING, type VisteAnswer } from "@/lib/piezas/core";
import { countSignals, reachedSignalGoal } from "@/lib/tonight/cold-start";
import { computeTonightForUser } from "@/lib/tonight-store";

/**
 * «Afina tu gusto» (FIL-I47-3): one-tap taste answers about the titles that rank on the user's
 * platforms. «La vi y me gustó» / «La vi, no tanto» write a watched title with the same implied
 * rating as «¿Las viste?» and the diary toast (FIL-28); «No la he visto» only records the answer.
 */

/** `PickEvent.kind` of an answer; its `lens` is `afina:<answer>`. */
export const AFINA_EVENT = "afina_answered";
const afinaLens = (answer: VisteAnswer) => `afina:${answer}`;

/** Rated watches + Quiero ver + «No la he visto» answers (see `countSignals`). */
export const countUserSignals = async (userId: string): Promise<number> => {
  const [rated, queue, skips] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(titles)
      .where(
        and(
          eq(titles.userId, userId),
          isNotNull(titles.watchedAt),
          or(isNotNull(titles.rating), isNotNull(titles.impliedRating)),
        ),
      ),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(listItems)
      .innerJoin(lists, eq(listItems.listId, lists.id))
      .where(and(eq(lists.userId, userId), eq(lists.slug, WATCHLIST_SLUG))),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(pickEvents)
      .where(and(eq(pickEvents.userId, userId), eq(pickEvents.kind, AFINA_EVENT), eq(pickEvents.lens, afinaLens("no")))),
  ]);
  return countSignals({ ratedWatched: rated[0]?.count ?? 0, queue: queue[0]?.count ?? 0, tasteSkips: skips[0]?.count ?? 0 });
};

export type AfinaCard = {
  catalogId: string;
  tmdbId: number;
  kind: "MOVIE" | "SERIES";
  name: string;
  year: number | null;
  posterPath: string | null;
  platform: Platform;
  rank: number;
};

/** Catalog ids the user already answered (any answer, ever): never asked twice. */
const answeredCatalogIds = async (userId: string) =>
  new Set(
    (
      await db
        .select({ catalogId: pickEvents.catalogId })
        .from(pickEvents)
        .where(and(eq(pickEvents.userId, userId), eq(pickEvents.kind, AFINA_EVENT)))
    ).flatMap((row) => (row.catalogId ? [row.catalogId] : [])),
  );

/**
 * The next cards: titles ranking on the user's platforms (best rank first, films and series
 * alternating by rank), not in their library and never answered.
 */
export const loadAfinaCards = async (userId: string, platforms: readonly Platform[], limit = 8): Promise<AfinaCard[]> => {
  if (platforms.length === 0) {
    return [];
  }
  let rows;
  try {
    rows = await db
      .select({
        catalogId: catalog.id,
        tmdbId: catalog.tmdbId,
        kind: catalog.kind,
        name: catalog.name,
        year: catalog.year,
        posterPath: catalog.posterPath,
        platform: serviceCharts.platform,
        rank: serviceCharts.rank,
      })
      .from(serviceCharts)
      .innerJoin(catalog, eq(catalog.id, serviceCharts.catalogId))
      .where(inArray(serviceCharts.platform, [...platforms]))
      .orderBy(asc(serviceCharts.rank), asc(serviceCharts.kind), asc(serviceCharts.platform));
  } catch {
    return [];
  }
  if (rows.length === 0) {
    return [];
  }
  const [owned, answered] = await Promise.all([
    db
      .select({ catalogId: titles.catalogId })
      .from(titles)
      .where(and(eq(titles.userId, userId), inArray(titles.catalogId, [...new Set(rows.map((row) => row.catalogId))]))),
    answeredCatalogIds(userId),
  ]);
  const skip = new Set([...owned.map((row) => row.catalogId), ...answered]);
  const cards: AfinaCard[] = [];
  for (const row of rows) {
    if (cards.length >= limit) break;
    if (skip.has(row.catalogId) || !row.posterPath) continue;
    skip.add(row.catalogId);
    cards.push(row);
  }
  return cards;
};

export type AfinaOutcome =
  | { ok: true; signals: number; reachedGoal: boolean }
  | { ok: false; error: string };

/**
 * One answer. Only a title on one of the user's charts, not in their library and not answered
 * before, is accepted. At the 10th signal the deck is recomputed now, so Hoy can say so.
 */
export const answerAfina = async (
  userId: string,
  platforms: readonly Platform[],
  catalogId: string,
  answer: VisteAnswer,
  now = new Date(),
): Promise<AfinaOutcome> => {
  if (platforms.length === 0) {
    return { ok: false, error: "Elige tus plataformas primero." };
  }
  const [charted] = await db
    .select({ id: serviceCharts.catalogId })
    .from(serviceCharts)
    .where(and(eq(serviceCharts.catalogId, catalogId), inArray(serviceCharts.platform, [...platforms])))
    .limit(1);
  if (!charted) {
    return { ok: false, error: "Esa carta ya no está en tus plataformas." };
  }
  if ((await answeredCatalogIds(userId)).has(catalogId)) {
    return { ok: false, error: "Ya respondiste esa." };
  }
  const owned = await db.query.titles.findFirst({
    where: and(eq(titles.userId, userId), eq(titles.catalogId, catalogId)),
    columns: { id: true },
  });
  if (owned) {
    return { ok: false, error: "Ya está en tu Filmia." };
  }
  const film = await db.query.catalog.findFirst({ where: eq(catalog.id, catalogId) });
  if (!film) {
    return { ok: false, error: "No encontramos ese título." };
  }

  const before = await countUserSignals(userId);
  let titleId: string | null = null;
  if (answer !== "no") {
    const result = await upsertTitleFromTmdbForUser(userId, {
      tmdbId: film.tmdbId,
      kind: film.kind,
      name: film.name,
      originalName: film.originalName,
      year: film.year,
      posterPath: film.posterPath,
      destination: "watched",
    });
    if (!result.ok) {
      return { ok: false, error: result.error };
    }
    titleId = result.titleId;
    // The engine's signal, never stars: `rating` stays the person's own.
    await db
      .update(titles)
      .set({ impliedRating: VISTE_RATING[answer] })
      .where(and(eq(titles.id, titleId), eq(titles.userId, userId)));
  }
  await db.insert(pickEvents).values({
    id: createId(),
    userId,
    titleId,
    catalogId,
    kind: AFINA_EVENT,
    lens: afinaLens(answer),
    createdAt: now,
  });

  const signals = await countUserSignals(userId);
  const reachedGoal = reachedSignalGoal(before, signals);
  if (reachedGoal) {
    // Synchronous on purpose: the page refreshes right after and should deal the new deck.
    await computeTonightForUser(userId, now).catch(() => null);
    // The recommended pool now has seeds: rebuild it after the response (TMDB), as FIL-26 does.
    scheduleAfterResponse(async () => {
      try {
        const { computeRecosForUser } = await import("@/lib/tonight/reco-store");
        await computeRecosForUser(userId);
      } catch {
        // The nightly cron builds it anyway.
      }
    });
  }
  return { ok: true, signals, reachedGoal };
};
