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
  rotateSeeds,
  VISTE_BATCH,
  VISTE_MAX_SEEDS,
  VISTE_RATING,
  visteLens,
  visteSummary,
  type VisteAnswer,
} from "@/lib/piezas/core";
import { parseThreadPeople } from "@/lib/people/core";
import { loadLibraryContext, loadWatchedFilms } from "@/lib/people/store";
import { loadRutas } from "@/lib/rutas/store";
import { getTmdbRelated, isTmdbConfigured } from "@/lib/tmdb";
import { scheduleTonightRecompute, type TonightCard, type TonightLensView } from "@/lib/tonight-store";

/**
 * «¿Las viste?» (FIL-I26-3, board P2): films you have probably seen, three at a time and as many
 * as you want (one per seed), answered with three buttons. «La vi» writes a watched title (with an implied rating the engine
 * reads, the only real source of «no me gustó», shown as «Te gustó» / «No tanto», never as stars); «No la vi» writes nothing but the event.
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

/** How many the person answered today, for Hoy's door card (no TMDB). */
export const visteStatus = async (userId: string, now = new Date()) => {
  const events = await todaysEvents(userId, now);
  const answered = new Set(events.filter((event) => event.kind === "viste_answered").map((event) => event.catalogId));
  return { answered: answered.size };
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

const cardsOf = async (events: Awaited<ReturnType<typeof todaysEvents>>) => {
  const answers = new Map(
    events.flatMap((event) =>
      event.kind === "viste_answered" && event.catalogId ? [[event.catalogId, answerOfLens(event.lens)] as const] : [],
    ),
  );
  const dealt = events.filter((event) => event.kind === "viste_dealt" && event.catalogId);
  if (dealt.length === 0) {
    return [];
  }
  const films = await db.query.catalog.findMany({ where: inArray(catalog.id, dealt.map((event) => event.catalogId!)) });
  const byId = new Map(films.map((film) => [film.id, film]));
  return dealt
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .flatMap((event) => {
      const film = byId.get(event.catalogId!);
      return film ? [toCard(film, seedOfLens(event.lens), answers.get(film.id) ?? null)] : [];
    });
};

/**
 * The next three: TMDB's best known pairings for your seeds (one per seed, the seeds rotating
 * with each batch so every film of yours gets its turn), never a film you have or were already
 * asked about. What you answer «La vi» becomes a seed too, so the supply grows as you go.
 */
const dealBatch = async (userId: string, now: Date, batchesToday: number): Promise<VisteCard[]> => {
  if (!isTmdbConfigured()) {
    return [];
  }
  const ctx = await loadLibraryContext(userId, now);
  const seeds = ctx.seeds.slice(0, VISTE_MAX_SEEDS);
  if (seeds.length === 0) {
    return [];
  }
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
  const usable = (film: { kind: string; voteCount: number; year: number | null }) =>
    film.kind === "MOVIE" && film.voteCount >= VISTE_MIN_VOTES && film.year != null && film.year <= year;
  const perSeed = await Promise.all(
    rotateSeeds(seeds, batchesToday).map(async (seed) => {
      const pages = await Promise.all(
        [1, 2].map((page) => getTmdbRelated(seed.tmdbId, "MOVIE", "recommendations", page).catch(() => [])),
      );
      return { seedName: seed.name, candidates: pages.flat().filter(usable) };
    }),
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

/** Today's cards so far, dealing the first three on the first visit of the day. */
export const dealVisteToday = async (userId: string, now = new Date()): Promise<VisteCard[]> => {
  const cards = await cardsOf(await todaysEvents(userId, now));
  return cards.length > 0 ? cards : dealBatch(userId, now, 0);
};

/** Three more, for as long as the person keeps answering (no daily limit). Empty when none are left. */
export const dealMoreViste = async (userId: string, now = new Date()): Promise<VisteCard[]> => {
  const events = await todaysEvents(userId, now);
  const dealt = events.filter((event) => event.kind === "viste_dealt").length;
  return dealBatch(userId, now, Math.ceil(dealt / VISTE_BATCH));
};

export type VisteOutcome =
  | { ok: true; remaining: number; titleId: string | null; summary: string | null }
  | { ok: false; error: string };

/** What the batch just answered changed: people new to your universe, the rutas they moved. */
const summaryFor = async (userId: string, now: Date) => {
  const cards = (await cardsOf(await todaysEvents(userId, now))).slice(-VISTE_BATCH);
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
    // The engine's signal, never stars the person chose: `rating` is untouched.
    await db
      .update(titles)
      .set({ impliedRating: VISTE_RATING[answer] })
      .where(and(eq(titles.id, titleId), eq(titles.userId, userId)));
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

/** Hoy's door to «¿Las viste?» (a lens of one card): always open, no daily limit. */
export const visteDoorLens = (answered: number): TonightLensView => {
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
          ? "Películas que quizá ya viste: la vi y me gustó, la vi y no tanto, o no la vi. Las que quieras."
          : `Llevas ${answered} hoy. Sigue cuando quieras.`,
      cta: answered === 0 ? "Empezar" : "Seguir",
      href: VISTE_PATH,
    },
  };
  return { slug: VISTE_LENS, name: VISTE_NAME, kind: "pieza", titles: [card] };
};
