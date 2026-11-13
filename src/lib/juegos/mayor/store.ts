import { createId } from "@paralleldrive/cuid2";
import { and, eq, gte, inArray, isNotNull } from "drizzle-orm";
import { catalog, db } from "@/db";
import { mxToday } from "@/lib/cine-core";
import {
  buildSequence,
  dailyLensOf,
  dayStreak,
  dailySeed,
  filmsFor,
  MAYOR_DAILY_STEPS,
  MAYOR_FREE_LENGTH,
  MAYOR_ID,
  MAYOR_LENSES,
  MAYOR_MIN_VOTES,
  stepIds,
  stepsOf,
  truthOf,
  type MayorCandidate,
  type MayorGuess,
  type MayorLensId,
} from "@/lib/juegos/mayor/core";
import {
  bestScore,
  countAccounts,
  createPartida,
  DailyTakenError,
  finishedDailyDays,
  finishPartida,
  getOrCreateRonda,
  loadDayTable,
  readDailyPartida,
  readOpenFreePartida,
  readPartida,
  recordAnswer,
  type DayTableRow,
  type PartidaMode,
  type PartidaRow,
} from "@/lib/juegos/partidas";

/**
 * Mayor o menor on the database (FIL-I52-2/3): free streaks and the daily over the partida engine.
 * The server keeps the sequence and judges every answer; a view sent to the client carries the
 * hidden film's name and poster, never its value, until that step is answered.
 */

const CANDIDATE_COLUMNS = {
  id: catalog.id,
  name: catalog.name,
  posterPath: catalog.posterPath,
  imdbRating: catalog.imdbRating,
  imdbVotes: catalog.imdbVotes,
  year: catalog.year,
  runtimeMinutes: catalog.runtimeMinutes,
  rtScore: catalog.rtScore,
};

const LENS_COLUMN = {
  imdb: catalog.imdbRating,
  year: catalog.year,
  runtime: catalog.runtimeMinutes,
  critica: catalog.rtScore,
} as const;

/** Where the films come from; tests pass their own seeded pool. */
export type MayorSources = { pool: (lens: MayorLensId) => Promise<MayorCandidate[]> };

/** Well-known films with a poster and the lens's number (the lens filters the rest in `isPlayable`). */
export const loadMayorPool = (lens: MayorLensId): Promise<MayorCandidate[]> =>
  db
    .select(CANDIDATE_COLUMNS)
    .from(catalog)
    .where(
      and(
        eq(catalog.kind, "MOVIE"),
        isNotNull(catalog.posterPath),
        gte(catalog.imdbVotes, MAYOR_MIN_VOTES),
        isNotNull(catalog.imdbRating),
        isNotNull(LENS_COLUMN[lens]),
      ),
    );

const defaultSources: MayorSources = { pool: loadMayorPool };

const loadFilms = async (ids: readonly string[]) => {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map<string, MayorCandidate>();
  const rows = await db.select(CANDIDATE_COLUMNS).from(catalog).where(inArray(catalog.id, unique));
  return new Map(rows.map((row) => [row.id, row]));
};

// ---------------------------------------------------------------------------
// Views (what the client gets)
// ---------------------------------------------------------------------------

export type MayorCard = { catalogId: string; name: string; posterPath: string | null };

export type MayorStep = {
  index: number;
  /** The shown film and its value, already formatted. */
  left: MayorCard & { value: string };
  /** The hidden film: never its value. */
  right: MayorCard;
};

export type MayorView = {
  partidaId: string;
  mode: PartidaMode;
  lens: MayorLensId;
  day: string | null;
  /** The step to answer; null once the partida is over. */
  step: MayorStep | null;
  /** One per answer so far, in order. */
  answers: boolean[];
  score: number;
  /** Steps in the partida (10 in the daily; the drawn length in a free streak). */
  total: number;
  finished: boolean;
  /** Best free score in this lens (the free mode's record); 0 before any. */
  best: number;
};

type Content = { sequence: string[] };

const sequenceOf = (partida: PartidaRow) => ((partida.content as Content | null)?.sequence ?? []).filter((id) => typeof id === "string");
const answersOf = (partida: PartidaRow) => (partida.answers as unknown[]).map((answer) => answer === true);
const lensOf = (partida: PartidaRow) => (MAYOR_LENSES[partida.lens as MayorLensId] ? (partida.lens as MayorLensId) : "imdb");

const card = (film: MayorCandidate | undefined, id: string): MayorCard => ({
  catalogId: id,
  name: film?.name ?? "Película",
  posterPath: film?.posterPath ?? null,
});

const viewOf = async (partida: PartidaRow): Promise<MayorView> => {
  const lens = lensOf(partida);
  const sequence = sequenceOf(partida);
  const answers = answersOf(partida);
  const total = stepsOf(sequence, lens);
  const finished = partida.finishedAt != null || answers.length >= total;
  const ids = finished ? null : stepIds(sequence, lens, answers.length);
  const films = await loadFilms(ids ?? []);
  let step: MayorStep | null = null;
  if (ids) {
    const left = films.get(ids[0]);
    const value = left ? MAYOR_LENSES[lens].leftValue(left) : null;
    step = {
      index: answers.length,
      left: { ...card(left, ids[0]), value: value == null ? "—" : MAYOR_LENSES[lens].format(value) },
      right: card(films.get(ids[1]), ids[1]),
    };
  }
  return {
    partidaId: partida.id,
    mode: partida.mode as PartidaMode,
    lens,
    day: partida.day,
    step,
    answers,
    score: partida.score,
    total,
    finished,
    best: await bestScore(partida.userId, MAYOR_ID, "libre", lens),
  };
};

// ---------------------------------------------------------------------------
// Free streak (FIL-I52-2)
// ---------------------------------------------------------------------------

/** A new free partida in `lens`; an unfinished one is closed first («Otra vez»). */
export const startFreeMayor = async (userId: string, lens: MayorLensId, now = new Date(), sources = defaultSources) => {
  const open = await readOpenFreePartida(userId, MAYOR_ID, lens);
  if (open) await finishPartida(open.id, now);
  const sequence = buildSequence({ pool: await sources.pool(lens), lens, seed: createId(), length: MAYOR_FREE_LENGTH });
  if (stepsOf(sequence, lens) < 1) return null;
  const partida = await createPartida({ userId, juego: MAYOR_ID, mode: "libre", lens, content: { sequence } satisfies Content, now });
  return viewOf(partida);
};

/** The free partida to show: the unfinished one (picked up where it stopped) or a new one. */
export const openFreeMayor = async (userId: string, lens: MayorLensId, now = new Date(), sources = defaultSources) => {
  const open = await readOpenFreePartida(userId, MAYOR_ID, lens);
  return open ? viewOf(open) : startFreeMayor(userId, lens, now, sources);
};

// ---------------------------------------------------------------------------
// The daily (FIL-I52-3)
// ---------------------------------------------------------------------------

export type DailyOpen = { status: "ok"; view: MayorView } | { status: "unavailable"; day: string; lens: MayorLensId };

class ShortPoolError extends Error {}

/**
 * Today's daily (Mexico City): the round is made on the first open of the day and is the same for
 * every account; the person's partida is made once and never again that day.
 */
export const openDailyMayor = async (userId: string, now = new Date(), sources = defaultSources): Promise<DailyOpen> => {
  const day = mxToday(now);
  const lens = dailyLensOf(day);
  const existing = await readDailyPartida(userId, MAYOR_ID, lens, day);
  if (existing) return { status: "ok", view: await viewOf(existing) };
  const needed = filmsFor(MAYOR_DAILY_STEPS, lens);
  let ronda;
  try {
    ronda = await getOrCreateRonda({
      juego: MAYOR_ID,
      lens,
      day,
      seed: dailySeed(day),
      build: async () => {
        const sequence = buildSequence({ pool: await sources.pool(lens), lens, seed: dailySeed(day), length: needed });
        if (sequence.length < needed) throw new ShortPoolError();
        return { sequence } satisfies Content;
      },
    });
  } catch (error) {
    if (error instanceof ShortPoolError) return { status: "unavailable", day, lens };
    throw error;
  }
  try {
    const partida = await createPartida({
      userId,
      juego: MAYOR_ID,
      mode: "diaria",
      lens,
      day,
      rondaId: ronda.id,
      content: { sequence: (ronda.content as Content).sequence } satisfies Content,
      now,
    });
    return { status: "ok", view: await viewOf(partida) };
  } catch (error) {
    // Two tabs opening at once: the other one won, show it.
    if (!(error instanceof DailyTakenError)) throw error;
    const partida = await readDailyPartida(userId, MAYOR_ID, lens, day);
    if (!partida) throw error;
    return { status: "ok", view: await viewOf(partida) };
  }
};

/** The person's daily of `day` if they started it (no new round, no new partida). */
export const readDailyMayor = async (userId: string, day: string) => {
  const partida = await readDailyPartida(userId, MAYOR_ID, dailyLensOf(day), day);
  return partida ? viewOf(partida) : null;
};

// ---------------------------------------------------------------------------
// Answering
// ---------------------------------------------------------------------------

export type MayorAnswerOutcome =
  | {
      ok: true;
      correct: boolean;
      /** The hidden value, revealed now that the step is answered. */
      revealed: string;
      view: MayorView;
    }
  | { ok: false; error: string; view?: MayorView };

/**
 * Judges step `index` of a partida. Only the owner, only the current step, only once: a second
 * tap or a retried request gets the current view back and changes nothing. A free streak ends at
 * the first miss; the daily goes on to the tenth.
 */
export const answerMayor = async (
  userId: string,
  partidaId: string,
  index: number,
  guess: MayorGuess,
  now = new Date(),
): Promise<MayorAnswerOutcome> => {
  const partida = await readPartida(userId, partidaId);
  if (!partida || partida.juego !== MAYOR_ID) return { ok: false, error: "No encontramos esa partida." };
  const answers = answersOf(partida);
  if (partida.finishedAt || index !== answers.length) {
    return { ok: false, error: "Esa ya la contestaste.", view: await viewOf(partida) };
  }
  const lens = lensOf(partida);
  const sequence = sequenceOf(partida);
  const ids = stepIds(sequence, lens, index);
  if (!ids) return { ok: false, error: "Esa partida ya terminó.", view: await viewOf(partida) };
  const films = await loadFilms(ids);
  const left = films.get(ids[0]);
  const right = films.get(ids[1]);
  if (!left || !right) return { ok: false, error: "No encontramos esas películas.", view: await viewOf(partida) };
  // A film whose number changed into a tie since the round was drawn counts in the person's favour.
  const truth = truthOf(lens, left, right);
  const correct = truth == null || truth === guess;
  const total = stepsOf(sequence, lens);
  const nextCount = answers.length + 1;
  const score = answers.filter(Boolean).length + (correct ? 1 : 0);
  const finished = partida.mode === "diaria" ? nextCount >= total : !correct || nextCount >= total;
  const stored = await recordAnswer({ partida, answer: correct, score, finished, now });
  const fresh = (await readPartida(userId, partidaId))!;
  if (!stored) return { ok: false, error: "Esa ya la contestaste.", view: await viewOf(fresh) };
  const value = MAYOR_LENSES[lens].rightValue(right);
  return { ok: true, correct, revealed: value == null ? "—" : MAYOR_LENSES[lens].format(value), view: await viewOf(fresh) };
};

// ---------------------------------------------------------------------------
// The daily's result (FIL-I52-3)
// ---------------------------------------------------------------------------

export type DailyResult = {
  view: MayorView;
  /** Everyone who opened today's daily, finished first by score; the person's row has `me`. */
  table: Array<DayTableRow & { me: boolean }>;
  /** Days in a row with a finished daily, this one included. */
  streak: number;
  /** Accounts that have not opened today's daily (a count, never names). */
  notYet: number;
};

/** What the result screen needs once the person's daily is over. Database only. */
export const loadDailyResult = async (userId: string, view: MayorView, now = new Date()): Promise<DailyResult> => {
  const day = view.day ?? mxToday(now);
  const [rows, days, accounts] = await Promise.all([
    loadDayTable(MAYOR_ID, view.lens, day),
    finishedDailyDays(userId, MAYOR_ID),
    countAccounts(),
  ]);
  return {
    view,
    table: rows.map((row) => ({ ...row, me: row.userId === userId })),
    streak: dayStreak(days, mxToday(now)),
    notYet: Math.max(0, accounts - rows.length),
  };
};
