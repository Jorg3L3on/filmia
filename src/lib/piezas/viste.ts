import { createId } from "@paralleldrive/cuid2";
import { and, eq, gte, inArray, isNotNull, isNull } from "drizzle-orm";
import { catalog, db, pickEvents, titles, type CatalogRow } from "@/db";
import { upsertTitleFromTmdbForUser } from "@/lib/add-title-from-tmdb";
import { scheduleCatalogEnrichment } from "@/lib/catalog-enrich";
import { findOrCreateCatalog } from "@/lib/catalog";
import {
  answerOfLens,
  pickVisteCards,
  sameMxDay,
  VISTE_LENS,
  VISTE_NAME,
  VISTE_PATH,
  VISTE_PER_DAY,
  VISTE_RATING,
  visteLens,
  visteSummary,
  type VisteAnswer,
} from "@/lib/piezas/core";
import { parseThreadPeople } from "@/lib/rutas/core";
import { loadFactoryContext } from "@/lib/rutas/factories";
import { loadRutas, loadWatchedFilms } from "@/lib/rutas/store";
import { getTmdbRelated, isTmdbConfigured } from "@/lib/tmdb";
import { scheduleTonightRecompute, type TonightCard, type TonightLensView } from "@/lib/tonight-store";

/**
 * «¿Las viste?» (FIL-I26-3, board P2): three films a day you have probably seen, one per seed,
 * answered with three buttons. «La vi» writes a watched title (with an implicit rating Afinidad
 * reads: the only real source of «no me gustó»); «No la vi» writes nothing but the event.
 */

/** Seen by enough people that you probably did too. */
const VISTE_MIN_VOTES = 1500;
/** Events only look back this far for «today» (a Mexico City day fits inside). */
const DAY_WINDOW_MS = 36 * 60 * 60 * 1000;

export type VisteCard = {
  catalogId: string;
  tmdbId: number;
  name: string;
  originalName: string | null;
  year: number | null;
  posterPath: string | null;
  director: string | null;
  seedName: string | null;
  answer: VisteAnswer | null;
};

/** `viste_dealt` carries the seed in its lens, for the card's «Sale porque viste X». */
const dealtLens = (seedName: string) => `${VISTE_LENS}:${seedName}`.slice(0, 200);
const seedOfLens = (lens: string | null) =>
  lens?.startsWith(`${VISTE_LENS}:`) ? lens.slice(VISTE_LENS.length + 1) : null;

const todaysEvents = async (userId: string, now: Date) => {
  const rows = await db.query.pickEvents.findMany({
    where: and(
      eq(pickEvents.userId, userId),
      inArray(pickEvents.kind, ["viste_dealt", "viste_answered"]),
      gte(pickEvents.createdAt, new Date(now.getTime() - DAY_WINDOW_MS)),
    ),
    columns: { catalogId: true, kind: true, lens: true, createdAt: true },
  });
  return rows.filter((row) => sameMxDay(row.createdAt, now));
};

/** A watched film to ask around: without one there is nothing to deal. */
export const hasVisteSeeds = async (userId: string) => {
  const row = await db
    .select({ id: titles.id })
    .from(titles)
    .innerJoin(catalog, eq(titles.catalogId, catalog.id))
    .where(and(eq(titles.userId, userId), isNotNull(titles.watchedAt), eq(catalog.kind, "MOVIE")))
    .limit(1);
  return row.length > 0;
};

/** How far today's three went, for Hoy's door card (no TMDB). */
export const visteStatus = async (userId: string, now = new Date()) => {
  const events = await todaysEvents(userId, now);
  const answered = new Set(events.filter((event) => event.kind === "viste_answered").map((event) => event.catalogId));
  return { answered: answered.size, done: answered.size >= VISTE_PER_DAY };
};

const toCard = (film: CatalogRow, seedName: string | null, answer: VisteAnswer | null): VisteCard => ({
  catalogId: film.id,
  tmdbId: film.tmdbId,
  name: film.name,
  originalName: film.originalName,
  year: film.year,
  posterPath: film.posterPath,
  director: parseThreadPeople(film.tmdbPeople).find((person) => person.role === "director")?.name ?? null,
  seedName,
  answer,
});

/**
 * Today's three, dealt on the first visit of the day: TMDB's best known pairings for your top
 * seeds (one per seed), never a film you have or were already asked about.
 */
export const dealVisteToday = async (userId: string, now = new Date()): Promise<VisteCard[]> => {
  const events = await todaysEvents(userId, now);
  const answers = new Map(
    events.flatMap((event) =>
      event.kind === "viste_answered" && event.catalogId ? [[event.catalogId, answerOfLens(event.lens)] as const] : [],
    ),
  );
  const dealtToday = events.filter((event) => event.kind === "viste_dealt" && event.catalogId);
  if (dealtToday.length > 0) {
    const films = await db.query.catalog.findMany({
      where: inArray(catalog.id, dealtToday.map((event) => event.catalogId!)),
    });
    const byId = new Map(films.map((film) => [film.id, film]));
    return dealtToday.flatMap((event) => {
      const film = byId.get(event.catalogId!);
      return film ? [toCard(film, seedOfLens(event.lens), answers.get(film.id) ?? null)] : [];
    });
  }
  if (!isTmdbConfigured()) {
    return [];
  }

  const ctx = await loadFactoryContext(userId, now);
  const [owned, asked] = await Promise.all([
    db.query.titles.findMany({ where: eq(titles.userId, userId), with: { catalog: { columns: { tmdbId: true } } }, columns: { id: true } }),
    db
      .select({ tmdbId: catalog.tmdbId })
      .from(pickEvents)
      .innerJoin(catalog, eq(pickEvents.catalogId, catalog.id))
      .where(and(eq(pickEvents.userId, userId), eq(pickEvents.kind, "viste_dealt"))),
  ]);
  const exclude = new Set<number>([...owned.map((row) => row.catalog.tmdbId), ...asked.map((row) => row.tmdbId)]);
  const year = Number(ctx.today.slice(0, 4));
  const perSeed = await Promise.all(
    ctx.seeds.slice(0, VISTE_PER_DAY).map(async (seed) => ({
      seedName: seed.name,
      candidates: (await getTmdbRelated(seed.tmdbId, "MOVIE", "recommendations").catch(() => [])).filter(
        (film) => film.kind === "MOVIE" && film.voteCount >= VISTE_MIN_VOTES && film.year != null && film.year <= year,
      ),
    })),
  );
  const picks = pickVisteCards(perSeed, exclude);
  const cards: VisteCard[] = [];
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
    cards.push(toCard(row, pick.seedName, null));
  }
  if (cards.length > 0) {
    await db.insert(pickEvents).values(
      cards.map((card, index) => ({
        id: createId(),
        userId,
        titleId: null,
        catalogId: card.catalogId,
        kind: "viste_dealt",
        lens: dealtLens(card.seedName ?? ""),
        // Keep the order they were dealt in.
        createdAt: new Date(now.getTime() + index),
      })),
    );
  }
  return cards;
};

export type VisteOutcome =
  | { ok: true; remaining: number; titleId: string | null; summary: string | null }
  | { ok: false; error: string };

/** What today's answers changed: people new to your universe, the rutas they moved. */
const summaryFor = async (userId: string, now: Date) => {
  const cards = await dealVisteToday(userId, now);
  const seen = cards.filter((card) => card.answer === "liked" || card.answer === "meh");
  if (seen.length === 0) {
    return visteSummary({ seen: 0, newPeople: [], rutas: [] });
  }
  const seenIds = seen.map((card) => card.catalogId);
  const [films, others] = await Promise.all([
    db.query.catalog.findMany({ where: inArray(catalog.id, seenIds), columns: { tmdbPeople: true } }),
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
  const rutas = (await loadRutas(userId, { statuses: ["activa", "espera"], now }))
    .filter((view) => view.steps.some((step) => seenIds.includes(step.catalogId)))
    .map((view) => ({ shortTitle: view.shortTitle, done: view.progress.done, total: view.progress.total }));
  return visteSummary({ seen: seen.length, newPeople, rutas });
};

/** One answer. A film not dealt to this person today is refused. */
export const answerViste = async (
  userId: string,
  catalogId: string,
  answer: VisteAnswer,
  now = new Date(),
): Promise<VisteOutcome> => {
  const events = await todaysEvents(userId, now);
  if (!events.some((event) => event.kind === "viste_dealt" && event.catalogId === catalogId)) {
    return { ok: false, error: "Esa carta no es de hoy." };
  }
  if (events.some((event) => event.kind === "viste_answered" && event.catalogId === catalogId)) {
    return { ok: false, error: "Ya respondiste esa." };
  }
  const film = await db.query.catalog.findFirst({ where: eq(catalog.id, catalogId) });
  if (!film) {
    return { ok: false, error: "No encontramos esa película." };
  }

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
    // Never over a rating the person gave themselves.
    await db
      .update(titles)
      .set({ rating: VISTE_RATING[answer] })
      .where(and(eq(titles.id, titleId), eq(titles.userId, userId), isNull(titles.rating)));
    scheduleTonightRecompute(userId);
  }
  await db.insert(pickEvents).values({
    id: createId(),
    userId,
    titleId,
    catalogId,
    kind: "viste_answered",
    lens: visteLens(answer),
    createdAt: now,
  });

  const answered = new Set([
    ...events.filter((event) => event.kind === "viste_answered").map((event) => event.catalogId),
    catalogId,
  ]);
  const dealt = events.filter((event) => event.kind === "viste_dealt").length;
  const remaining = Math.max(0, dealt - answered.size);
  return { ok: true, remaining, titleId, summary: remaining === 0 ? await summaryFor(userId, now) : null };
};

/** Hoy's door to today's three (a lens of one card), while any is left to answer. */
export const visteDoorLens = (answered: number): TonightLensView => {
  const left = VISTE_PER_DAY - answered;
  const card: TonightCard = {
    id: `__${VISTE_LENS}__`,
    name: VISTE_NAME,
    kind: "MOVIE",
    year: null,
    rating: null,
    posterPath: null,
    platform: null,
    imdbRating: null,
    runtimeMinutes: null,
    components: { gusto: 0.5, calidad: 0.5, impulso: 0, novedad: 0, reposo: 0, fatiga: 1 },
    reasons: [],
    wildcard: false,
    pinned: false,
    posterAmbient: null,
    queueNote: null,
    overview: null,
    leads: [],
    source: "queue",
    reco: null,
    portal: {
      eyebrow: "Diez segundos",
      title: VISTE_NAME,
      body:
        answered === 0
          ? "Tres películas que quizá ya viste. La vi y me gustó, la vi y no tanto, o no la vi."
          : `Te ${left === 1 ? "falta una" : `faltan ${left}`} de hoy.`,
      cta: answered === 0 ? "Empezar" : "Seguir",
      href: VISTE_PATH,
    },
  };
  return { slug: VISTE_LENS, name: VISTE_NAME, kind: "pieza", titles: [card] };
};
