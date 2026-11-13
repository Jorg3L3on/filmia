import { createId } from "@paralleldrive/cuid2";
import { and, desc, eq, inArray, isNotNull, isNull, like } from "drizzle-orm";
import { catalog, db, listItems, lists, pickEvents, titles, type CatalogRow } from "@/db";
import { upsertTitleFromTmdbForUser } from "@/lib/add-title-from-tmdb";
import { findOrCreateCatalog } from "@/lib/catalog";
import { scheduleCatalogEnrichment } from "@/lib/catalog-enrich";
import { catalogIdOfTitle } from "@/lib/list-items";
import { WATCHLIST_SLUG } from "@/lib/lists";
import { parseThreadPeople } from "@/lib/people/core";
import { loadLibraryContext, loadWatchedFilms } from "@/lib/people/store";
import { discoverTmdb, getTmdbRelated, isTmdbConfigured, type TmdbDiscoverResult } from "@/lib/tmdb";
import { weekKeyOf } from "@/lib/juegos/core";
import {
  answeredLens,
  dealtLens,
  epochLabel,
  epochsOfWeek,
  isSeenAnswer,
  parseTandaLens,
  pickTanda,
  TANDA_ANSWERED_KIND,
  TANDA_DEALT_KIND,
  TANDA_MIN_VOTES,
  TANDA_RATING,
  TANDA_SIZE,
  type TandaAnswer,
  type TandaSlot,
} from "@/lib/juegos/tanda/core";
import { scheduleTonightRecompute } from "@/lib/tonight-store";

/**
 * La tanda (FIL-I50-3) on the database. The week's ten are dealt once (`tanda_dealt` events, one per
 * card, in order) and read back on every visit; each answer is a `tanda_answered` event. TMDB is
 * only called the first time a person opens the week's tanda, within a fixed budget.
 */

/** Afines come from the person's best seeds, one TMDB page each. */
const AFIN_SEEDS = 2;

export type TandaCard = {
  catalogId: string;
  tmdbId: number;
  name: string;
  year: number | null;
  posterPath: string | null;
  director: string | null;
  slot: TandaSlot;
  answer: TandaAnswer | null;
};

export type TandaState = {
  week: string;
  epoch: string;
  cards: TandaCard[];
};

const weekEvents = (userId: string, week: string) =>
  db.query.pickEvents.findMany({
    where: and(
      eq(pickEvents.userId, userId),
      inArray(pickEvents.kind, [TANDA_DEALT_KIND, TANDA_ANSWERED_KIND]),
      like(pickEvents.lens, `${week}|%`),
    ),
    columns: { id: true, kind: true, lens: true, catalogId: true, titleId: true, createdAt: true },
    orderBy: [pickEvents.createdAt],
  });

const toCard = (film: CatalogRow, slot: TandaSlot, answer: TandaAnswer | null): TandaCard => ({
  catalogId: film.id,
  tmdbId: film.tmdbId,
  name: film.name,
  year: film.year,
  posterPath: film.posterPath,
  director: parseThreadPeople(film.tmdbPeople).find((person) => person.role === "director")?.name ?? null,
  slot,
  answer,
});

const stateOf = async (week: string, events: Awaited<ReturnType<typeof weekEvents>>): Promise<TandaState> => {
  const dealt = events.filter((event) => event.kind === TANDA_DEALT_KIND && event.catalogId);
  const answers = new Map<string, TandaAnswer>();
  for (const event of events) {
    const { answer } = parseTandaLens(event.lens);
    if (event.kind === TANDA_ANSWERED_KIND && event.catalogId && answer) answers.set(event.catalogId, answer);
  }
  const films = dealt.length
    ? await db.query.catalog.findMany({ where: inArray(catalog.id, dealt.map((event) => event.catalogId!)) })
    : [];
  const byId = new Map(films.map((film) => [film.id, film]));
  return {
    week,
    epoch: epochLabel(epochsOfWeek(week).main),
    cards: dealt.flatMap((event) => {
      const film = byId.get(event.catalogId!);
      return film ? [toCard(film, parseTandaLens(event.lens).slot ?? "p", answers.get(film.id) ?? null)] : [];
    }),
  };
};

/** This week's tanda without dealing (Hoy's block, the portada): no TMDB. */
export const readTanda = async (userId: string, now = new Date()) => {
  const week = weekKeyOf(now);
  return stateOf(week, await weekEvents(userId, week));
};

/** How far the person is this week, for Hoy and the portada. */
export const tandaProgress = async (userId: string, now = new Date()) => {
  const week = weekKeyOf(now);
  const events = await db.query.pickEvents.findMany({
    where: and(
      eq(pickEvents.userId, userId),
      inArray(pickEvents.kind, [TANDA_DEALT_KIND, TANDA_ANSWERED_KIND]),
      like(pickEvents.lens, `${week}|%`),
    ),
    columns: { kind: true, lens: true, catalogId: true },
  });
  const answered = new Set(events.filter((event) => event.kind === TANDA_ANSWERED_KIND).map((event) => event.catalogId));
  const seen = events.filter((event) => {
    const { answer } = parseTandaLens(event.lens);
    return event.kind === TANDA_ANSWERED_KIND && answer != null && isSeenAnswer(answer);
  }).length;
  const dealt = events.filter((event) => event.kind === TANDA_DEALT_KIND).length;
  return {
    week,
    epoch: epochLabel(epochsOfWeek(week).main),
    dealt,
    answered: answered.size,
    seen,
    done: dealt > 0 && answered.size >= dealt,
  };
};

/** TMDB films in the library, or already asked in a game or in ¿Las viste?: never dealt again. */
const excludedTmdbIds = async (userId: string) => {
  const [owned, asked] = await Promise.all([
    db
      .select({ tmdbId: catalog.tmdbId })
      .from(titles)
      .innerJoin(catalog, eq(titles.catalogId, catalog.id))
      .where(eq(titles.userId, userId)),
    db
      .select({ tmdbId: catalog.tmdbId })
      .from(pickEvents)
      .innerJoin(catalog, eq(pickEvents.catalogId, catalog.id))
      .where(and(eq(pickEvents.userId, userId), inArray(pickEvents.kind, [TANDA_DEALT_KIND, "viste_answered"]))),
  ]);
  return new Set([...owned, ...asked].map((row) => row.tmdbId));
};

const usable = (year: number) => (film: TmdbDiscoverResult) =>
  film.kind === "MOVIE" && film.voteCount >= TANDA_MIN_VOTES && film.year != null && film.year <= year;

/** Where the candidates come from: TMDB in the app, a stub in tests. */
export type TandaSources = { discover: typeof discoverTmdb; related: typeof getTmdbRelated };
const TMDB_SOURCES: TandaSources = { discover: discoverTmdb, related: getTmdbRelated };

/** Deals the week's ten (at most 5 TMDB calls) and stores them; empty without TMDB or candidates. */
const dealTanda = async (userId: string, week: string, now: Date, sources: TandaSources | null): Promise<void> => {
  if (!sources && !isTmdbConfigured()) {
    return;
  }
  const { discover, related } = sources ?? TMDB_SOURCES;
  const { main, wild } = epochsOfWeek(week);
  const [ctx, exclude] = await Promise.all([loadLibraryContext(userId, now), excludedTmdbIds(userId)]);
  const year = Number(ctx.today.slice(0, 4));
  const ok = usable(year);
  const seeds = ctx.seeds.slice(0, AFIN_SEEDS);
  const [popularPages, wildPage, afinPages] = await Promise.all([
    Promise.all(
      [1, 2].map((page) =>
        discover({ sortBy: "vote_count.desc", yearFrom: main.from, yearTo: main.to, page }).catch(() => []),
      ),
    ),
    discover({ sortBy: "vote_count.desc", yearFrom: wild.from, yearTo: wild.to, page: 2 }).catch(() => []),
    Promise.all(seeds.map((seed) => related(seed.tmdbId, "MOVIE", "recommendations").catch(() => []))),
  ]);
  const knownGenres = new Set(ctx.seeds.flatMap((seed) => seed.genreIds));
  const picks = pickTanda({
    popular: popularPages.flat().filter(ok),
    afines: afinPages.flat().filter(ok),
    comodines: wildPage.filter(ok),
    exclude,
    knownGenres,
  });
  if (picks.length === 0) {
    return;
  }
  const rows: Array<{ film: CatalogRow; slot: TandaSlot }> = [];
  for (const pick of picks) {
    const { row, created } = await findOrCreateCatalog({
      tmdbId: pick.tmdbId,
      kind: "MOVIE",
      name: pick.name,
      originalName: pick.originalName,
      year: pick.year,
      posterPath: pick.posterPath,
    });
    if (created) {
      scheduleCatalogEnrichment(row);
    }
    rows.push({ film: row, slot: pick.slot });
  }
  await db.insert(pickEvents).values(
    rows.map(({ film, slot }, index) => ({
      id: createId(),
      userId,
      titleId: null,
      catalogId: film.id,
      kind: TANDA_DEALT_KIND,
      lens: dealtLens(week, slot),
      // Keep the order they were dealt in.
      createdAt: new Date(now.getTime() + index),
    })),
  );
};

/** The week's tanda, dealing it on the first visit of the week. The same ten on every reopen. */
export const openTanda = async (userId: string, now = new Date(), sources: TandaSources | null = null): Promise<TandaState> => {
  const week = weekKeyOf(now);
  const events = await weekEvents(userId, week);
  if (events.some((event) => event.kind === TANDA_DEALT_KIND)) {
    return stateOf(week, events);
  }
  await dealTanda(userId, week, now, sources);
  return stateOf(week, await weekEvents(userId, week));
};

export type TandaOutcome = { ok: true; titleId: string | null } | { ok: false; error: string };

/**
 * One answer to a card of this week's tanda. Seen answers write an undated watched title with an
 * implied rating (never stars); «no» writes only the event; «want» saves it in Quiero ver.
 */
export const answerTanda = async (
  userId: string,
  catalogId: string,
  answer: TandaAnswer,
  now = new Date(),
): Promise<TandaOutcome> => {
  const week = weekKeyOf(now);
  const events = await weekEvents(userId, week);
  if (!events.some((event) => event.kind === TANDA_DEALT_KIND && event.catalogId === catalogId)) {
    return { ok: false, error: "Esa carta no es de esta semana." };
  }
  if (events.some((event) => event.kind === TANDA_ANSWERED_KIND && event.catalogId === catalogId)) {
    return { ok: false, error: "Ya respondiste esa." };
  }
  const film = await db.query.catalog.findFirst({ where: eq(catalog.id, catalogId) });
  if (!film) {
    return { ok: false, error: "No encontramos esa película." };
  }

  let titleId: string | null = null;
  let created = false;
  if (answer !== "no") {
    const seen = isSeenAnswer(answer);
    const result = await upsertTitleFromTmdbForUser(userId, {
      tmdbId: film.tmdbId,
      kind: film.kind,
      name: film.name,
      originalName: film.originalName,
      year: film.year,
      posterPath: film.posterPath,
      destination: seen ? "watched" : "watchlist",
      undated: seen,
    });
    if (!result.ok) {
      return { ok: false, error: result.error };
    }
    titleId = result.titleId;
    created = result.created;
    if (seen) {
      // The engine's signal, never stars: only when the person has none of their own.
      const rating = TANDA_RATING[answer as keyof typeof TANDA_RATING];
      await db
        .update(titles)
        .set({ impliedRating: rating })
        .where(and(eq(titles.id, titleId), eq(titles.userId, userId), isNull(titles.rating)));
      scheduleTonightRecompute(userId);
    }
  }
  await db.insert(pickEvents).values({
    id: createId(),
    userId,
    titleId,
    catalogId,
    kind: TANDA_ANSWERED_KIND,
    lens: answeredLens(week, answer, created),
    createdAt: now,
  });
  return { ok: true, titleId };
};

/**
 * Deshacer: the week's last answer goes away. A title that answer created is removed too (with
 * its Quiero ver entry); one the person already had keeps everything but the implied rating.
 */
export const undoLastTanda = async (userId: string, now = new Date()): Promise<{ ok: true; catalogId: string } | { ok: false; error: string }> => {
  const week = weekKeyOf(now);
  const last = await db.query.pickEvents.findFirst({
    where: and(eq(pickEvents.userId, userId), eq(pickEvents.kind, TANDA_ANSWERED_KIND), like(pickEvents.lens, `${week}|%`)),
    orderBy: [desc(pickEvents.createdAt)],
    columns: { id: true, lens: true, titleId: true, catalogId: true },
  });
  if (!last?.catalogId) {
    return { ok: false, error: "No hay nada que deshacer." };
  }
  const { createdTitle } = parseTandaLens(last.lens);
  const dropEvent = db.delete(pickEvents).where(eq(pickEvents.id, last.id));
  if (last.titleId && createdTitle) {
    const watchlist = await db.query.lists.findFirst({
      where: and(eq(lists.userId, userId), eq(lists.slug, WATCHLIST_SLUG)),
      columns: { id: true },
    });
    // Only while it is still what the game wrote: no review, no stars of the person's own.
    const dropTitle = db
      .delete(titles)
      .where(and(eq(titles.id, last.titleId), eq(titles.userId, userId), isNull(titles.review), isNull(titles.rating)));
    if (watchlist) {
      await db.batch([
        dropEvent,
        db
          .delete(listItems)
          .where(and(eq(listItems.listId, watchlist.id), eq(listItems.catalogId, catalogIdOfTitle(last.titleId)))),
        dropTitle,
      ]);
    } else {
      await db.batch([dropEvent, dropTitle]);
    }
  } else {
    await dropEvent;
  }
  if (last.titleId) {
    scheduleTonightRecompute(userId);
  }
  return { ok: true, catalogId: last.catalogId };
};

export type TandaCorte = {
  seen: number;
  total: number;
  /** Watched films in the library now, and how many this tanda added. */
  library: number;
  added: number;
  /** People new to the person's universe through this tanda's films (directors, writers, music). */
  newPeople: string[];
};

/** Corte: the score, the library count and who joined the person's universe. */
export const tandaCorte = async (userId: string, now = new Date()): Promise<TandaCorte> => {
  const state = await readTanda(userId, now);
  const seenCards = state.cards.filter((card) => card.answer && isSeenAnswer(card.answer));
  const seenIds = seenCards.map((card) => card.catalogId);
  const [library, films, others] = await Promise.all([
    db.$count(titles, and(eq(titles.userId, userId), isNotNull(titles.watchedAt))),
    seenIds.length ? db.query.catalog.findMany({ where: inArray(catalog.id, seenIds), columns: { tmdbPeople: true } }) : [],
    loadWatchedFilms(userId, seenIds),
  ]);
  const known = new Set(others.flatMap(({ film }) => parseThreadPeople(film.tmdbPeople).map((person) => person.id)));
  const newPeople: string[] = [];
  for (const film of films) {
    for (const person of parseThreadPeople(film.tmdbPeople)) {
      if (person.role !== "cast" && !known.has(person.id) && !newPeople.includes(person.name)) {
        newPeople.push(person.name);
      }
    }
  }
  return {
    seen: seenCards.length,
    total: state.cards.length || TANDA_SIZE,
    library,
    added: seenCards.length,
    newPeople: newPeople.slice(0, 3),
  };
};
