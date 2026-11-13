import { createId } from "@paralleldrive/cuid2";
import { and, eq, gte, isNotNull, sql } from "drizzle-orm";
import { catalog, db, juegoPartidas } from "@/db";
import { createPartida, readPartida, recordAnswer, type PartidaRow } from "@/lib/juegos/partidas";
import { claimToPartida, createReto, readReto, RetoError, setFromPartida, type RetoRow, type RetoSide } from "@/lib/juegos/retos/store";
import {
  generateTrivia,
  publicQuestion,
  TRIVIA_ID,
  TRIVIA_MIN_VOTES,
  TRIVIA_MS,
  TRIVIA_QUESTIONS,
  triviaPoints,
  type PublicTriviaQuestion,
  type TriviaCandidate,
  type TriviaQuestion,
} from "@/lib/juegos/retos/trivia-core";

/**
 * Duelo de trivia on the database (FIL-I53-5). The clock is the server's: a question's time starts
 * when the server hands it over (`askedAt`, stamped once) and its points depend on when the answer
 * arrives. The right option is never in what reaches the client before the answer.
 */

type TriviaPartidaContent = {
  retoId: string;
  side: RetoSide;
  questions: TriviaQuestion[];
  /** ISO time each question was handed over, by index. */
  askedAt: Record<string, string>;
};

export type TriviaAnswer = { choice: number; points: number; elapsedMs: number };

export const loadTriviaPool = async (): Promise<TriviaCandidate[]> => {
  const rows = await db
    .select({
      id: catalog.id,
      name: catalog.name,
      posterPath: catalog.posterPath,
      year: catalog.year,
      runtimeMinutes: catalog.runtimeMinutes,
      imdbRating: catalog.imdbRating,
      tmdbGenres: catalog.tmdbGenres,
      tmdbPeople: catalog.tmdbPeople,
    })
    .from(catalog)
    .where(and(eq(catalog.kind, "MOVIE"), isNotNull(catalog.posterPath), gte(catalog.imdbVotes, TRIVIA_MIN_VOTES)));
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    posterPath: row.posterPath,
    year: row.year,
    runtimeMinutes: row.runtimeMinutes,
    imdbRating: row.imdbRating,
    genres: ((row.tmdbGenres as { name?: string }[] | null) ?? []).flatMap((genre) => (genre.name ? [genre.name] : [])),
    people: ((row.tmdbPeople as { name?: string; role?: string; order?: number }[] | null) ?? []).flatMap((person) =>
      person.name && person.role ? [{ name: person.name, role: person.role, order: person.order }] : [],
    ),
  }));
};

const contentOf = (partida: PartidaRow) => partida.content as TriviaPartidaContent;
const answersOf = (partida: PartidaRow) => partida.answers as TriviaAnswer[];

const createTriviaPartida = (userId: string, reto: Pick<RetoRow, "id" | "content">, side: RetoSide, now: Date) =>
  createPartida({
    userId,
    juego: TRIVIA_ID,
    mode: "reto",
    lens: "trivia",
    content: { retoId: reto.id, side, questions: (reto.content as { questions: TriviaQuestion[] }).questions, askedAt: {} } satisfies TriviaPartidaContent,
    now,
  });

/** A new duel toward `toUserId`: five fresh questions; the sender plays them first. */
export const startTriviaReto = async (input: {
  userId: string;
  toUserId: string;
  rematchOf?: string | null;
  now?: Date;
  pool?: () => Promise<TriviaCandidate[]>;
}) => {
  const now = input.now ?? new Date();
  const seed = createId();
  const questions = generateTrivia(await (input.pool ?? loadTriviaPool)(), seed);
  if (questions.length < TRIVIA_QUESTIONS) throw new RetoError("No hay suficientes películas para armar las preguntas.", "datos");
  const reto = await createReto({
    fromUserId: input.userId,
    toUserId: input.toUserId,
    juego: "trivia",
    lens: "trivia",
    seed,
    content: { questions },
    sent: false,
    rematchOf: input.rematchOf ?? null,
    now,
  });
  const partida = await createTriviaPartida(input.userId, reto, "from", now);
  await setFromPartida(reto.id, partida.id);
  return { ...reto, fromPartidaId: partida.id };
};

export type TriviaRival = { name: string; initial: string; finished: boolean; score: number | null; answers: TriviaAnswer[] };

export type TriviaView = {
  partidaId: string;
  retoId: string;
  /** The question to answer now (0-based), or `total` once over. */
  index: number;
  total: number;
  /** The current question, only once the server handed it over; never with its right option. */
  question: PublicTriviaQuestion | null;
  /** Milliseconds left on the server's clock for `question`. */
  msLeft: number | null;
  /** One per answered question: what the person chose, its points, and (now that it is answered) the right option. */
  answered: Array<TriviaAnswer & { correct: number }>;
  score: number;
  finished: boolean;
};

const viewOf = (partida: PartidaRow, now: Date): TriviaView => {
  const content = contentOf(partida);
  const answers = answersOf(partida);
  const total = content.questions.length;
  const index = answers.length;
  const finished = partida.finishedAt != null || index >= total;
  const askedAt = content.askedAt?.[String(index)];
  const current = !finished && askedAt ? content.questions[index] : undefined;
  return {
    partidaId: partida.id,
    retoId: content.retoId,
    index,
    total,
    question: current ? publicQuestion(current) : null,
    msLeft: current && askedAt ? Math.max(0, TRIVIA_MS - (now.getTime() - Date.parse(askedAt))) : null,
    answered: answers.map((answer, position) => ({ ...answer, correct: content.questions[position]!.correct })),
    score: partida.score,
    finished,
  };
};

const readTrivia = async (userId: string, partidaId: string) => {
  const partida = await readPartida(userId, partidaId);
  return partida && partida.juego === TRIVIA_ID ? partida : null;
};

export const viewTriviaPartida = async (userId: string, partidaId: string, now = new Date()) => {
  const partida = await readTrivia(userId, partidaId);
  return partida ? viewOf(partida, now) : null;
};

/** The person's side of a trivia reto (the receiver's partida is made on first open). */
export const openTriviaSide = async (userId: string, reto: RetoRow, now = new Date()): Promise<TriviaView | null> => {
  if (reto.fromUserId === userId) return reto.fromPartidaId ? viewTriviaPartida(userId, reto.fromPartidaId, now) : null;
  if (reto.toUserId !== userId) return null;
  if (reto.toPartidaId) return viewTriviaPartida(userId, reto.toPartidaId, now);
  const partida = await createTriviaPartida(userId, reto, "to", now);
  if (await claimToPartida(reto.id, partida.id)) return viewOf(partida, now);
  const fresh = await readReto(reto.id);
  return fresh?.toPartidaId ? viewTriviaPartida(userId, fresh.toPartidaId, now) : null;
};

/**
 * Hands question `index` over and starts its 15 seconds, once: asking again (a reload) returns
 * the same question with the time that is left, never a fresh clock.
 */
export const askTrivia = async (userId: string, partidaId: string, index: number, now = new Date()): Promise<TriviaView | null> => {
  const partida = await readTrivia(userId, partidaId);
  if (!partida) return null;
  const answers = answersOf(partida);
  if (partida.finishedAt || index !== answers.length || index >= contentOf(partida).questions.length) return viewOf(partida, now);
  await db
    .update(juegoPartidas)
    .set({
      content: sql`jsonb_set(${juegoPartidas.content}, ${`{askedAt,${index}}`}::text[], to_jsonb(${now.toISOString()}::text), true)`,
      updatedAt: now,
    })
    .where(and(eq(juegoPartidas.id, partidaId), sql`${juegoPartidas.content}->'askedAt'->>${String(index)} is null`));
  return viewTriviaPartida(userId, partidaId, now);
};

export type TriviaAnswerOutcome =
  | { ok: true; correct: boolean; right: number; points: number; elapsedMs: number; view: TriviaView }
  | { ok: false; error: string; view?: TriviaView };

/**
 * Judges question `index` by the server's clock: after 15 s it is worth nothing. `choice` −1 means
 * the time ran out on the screen. Only once per question.
 */
export const answerTrivia = async (
  userId: string,
  partidaId: string,
  index: number,
  choice: number,
  now = new Date(),
): Promise<TriviaAnswerOutcome> => {
  const partida = await readTrivia(userId, partidaId);
  if (!partida) return { ok: false, error: "No encontramos ese duelo." };
  const content = contentOf(partida);
  const answers = answersOf(partida);
  if (partida.finishedAt || index !== answers.length) return { ok: false, error: "Esa ya la contestaste.", view: viewOf(partida, now) };
  const question = content.questions[index];
  const askedAt = content.askedAt?.[String(index)];
  if (!question || !askedAt) return { ok: false, error: "Esa pregunta todavía no sale.", view: viewOf(partida, now) };
  const elapsedMs = now.getTime() - Date.parse(askedAt);
  const correct = choice === question.correct;
  const points = triviaPoints(correct, elapsedMs);
  const finished = index + 1 >= content.questions.length;
  const stored = await recordAnswer({
    partida,
    answer: { choice, points, elapsedMs } satisfies TriviaAnswer,
    score: partida.score + points,
    finished,
    now,
  });
  const fresh = (await readTrivia(userId, partidaId))!;
  if (!stored) return { ok: false, error: "Esa ya la contestaste.", view: viewOf(fresh, now) };
  return { ok: true, correct, right: question.correct, points, elapsedMs, view: viewOf(fresh, now) };
};

/** The rival's answers to the questions the person already answered (never ahead of them). */
export const rivalTriviaAnswers = async (rivalPartidaId: string | null, upTo: number) => {
  if (!rivalPartidaId) return [];
  const partida = await db.query.juegoPartidas.findFirst({ where: eq(juegoPartidas.id, rivalPartidaId) });
  return partida ? answersOf(partida).slice(0, upTo) : [];
};
