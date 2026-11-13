import { and, eq, gte, sql } from "drizzle-orm";
import { catalog, db } from "@/db";
import { DIARIA_MIN_VOTES, diariaNumber, type TitleGuess } from "@/lib/juegos/diarias/core";
import {
  buildRepartoRound,
  parseRepartoAnswers,
  REPARTO_CAST,
  REPARTO_ID,
  REPARTO_TRIES,
  repartoState,
  type RepartoAnswer,
  type RepartoCandidate,
  type RepartoPerson,
  type RepartoRound,
} from "@/lib/juegos/diarias/reparto";
import { appendAnswer, collectStrings, openDiaria, readOwnPartida, recentRoundContents, ShortPoolError } from "@/lib/juegos/diarias/store";
import type { PartidaRow } from "@/lib/juegos/partidas";

/**
 * Reparto misterioso on the database (FIL-I54-3). The round keeps the film and its six people; a
 * view carries only the people already uncovered, and the film only once the partida is over.
 */

export type RepartoSources = { pool: () => Promise<RepartoCandidate[]> };

/** Well-known films with at least six people stored (any role; `isRepartoPlayable` counts the cast). */
export const loadRepartoPool = (): Promise<RepartoCandidate[]> =>
  db
    .select({ id: catalog.id, tmdbId: catalog.tmdbId, imdbVotes: catalog.imdbVotes, tmdbPeople: catalog.tmdbPeople })
    .from(catalog)
    .where(and(eq(catalog.kind, "MOVIE"), gte(catalog.imdbVotes, DIARIA_MIN_VOTES), sql`jsonb_array_length(${catalog.tmdbPeople}) >= ${REPARTO_CAST}`));

const defaultSources: RepartoSources = { pool: loadRepartoPool };

export type RepartoView = {
  partidaId: string;
  day: string;
  number: number;
  step: number;
  /** Uncovered people, in reveal order (6th billed first); `billing` is 6…1. */
  cast: Array<RepartoPerson & { billing: number }>;
  hidden: number;
  tries: number;
  maxTries: number;
  misses: string[];
  marks: boolean[];
  solved: boolean;
  score: number;
  total: number;
  finished: boolean;
  /** The film, only once over. */
  answer: { name: string; year: number | null; posterPath: string | null } | null;
};

const roundOf = (partida: PartidaRow) => partida.content as RepartoRound;

const viewOf = async (partida: PartidaRow): Promise<RepartoView> => {
  const round = roundOf(partida);
  const state = repartoState(parseRepartoAnswers(partida.answers as unknown[]));
  const finished = partida.finishedAt != null || state.finished;
  const shown = finished ? round.cast.length : state.shown;
  const film = finished
    ? await db.query.catalog.findFirst({ where: eq(catalog.id, round.catalogId), columns: { name: true, year: true, posterPath: true } })
    : null;
  return {
    partidaId: partida.id,
    day: partida.day ?? "",
    number: diariaNumber(REPARTO_ID, partida.day ?? ""),
    step: (partida.answers as unknown[]).length,
    cast: round.cast.slice(0, shown).map((person, index) => ({ ...person, billing: round.cast.length - index })),
    hidden: round.cast.length - shown,
    tries: state.tries,
    maxTries: REPARTO_TRIES,
    misses: state.misses,
    marks: state.marks,
    solved: state.solved,
    score: state.score,
    total: REPARTO_TRIES,
    finished,
    answer: film ? { name: film.name, year: film.year, posterPath: film.posterPath } : null,
  };
};

export type RepartoOpen = { status: "ok"; view: RepartoView } | { status: "unavailable"; day: string };

export const openReparto = async (userId: string, now = new Date(), sources = defaultSources): Promise<RepartoOpen> => {
  const opened = await openDiaria({
    userId,
    juego: REPARTO_ID,
    now,
    build: async (seed, day) => {
      const exclude = collectStrings(await recentRoundContents(REPARTO_ID, day), "catalogId");
      const round = buildRepartoRound({ pool: await sources.pool(), seed, exclude });
      if (!round) throw new ShortPoolError();
      return round;
    },
  });
  return opened.status === "ok" ? { status: "ok", view: await viewOf(opened.partida) } : opened;
};

export type RepartoOutcome = { ok: true; correct: boolean; view: RepartoView } | { ok: false; error: string; view?: RepartoView };

/** A guess, or «Otra pista» (`guess` null), on try `step` + 1. */
export const answerReparto = async (userId: string, partidaId: string, step: number, guess: TitleGuess | null, now = new Date()): Promise<RepartoOutcome> => {
  const partida = await readOwnPartida(userId, REPARTO_ID, partidaId);
  if (!partida) return { ok: false, error: "No encontramos esa partida." };
  const answers = parseRepartoAnswers(partida.answers as unknown[]);
  const state = repartoState(answers);
  if (partida.finishedAt || state.finished || step !== (partida.answers as unknown[]).length) {
    return { ok: false, error: "Esa ya la contestaste.", view: await viewOf(partida) };
  }
  const correct = guess != null && guess.tmdbId === roundOf(partida).tmdbId;
  const answer: RepartoAnswer = { g: guess?.tmdbId ?? null, n: guess?.name ?? null, ok: correct };
  const next = repartoState([...answers, answer]);
  const result = await appendAnswer({ userId, partida, answer, score: next.score, finished: next.finished, now });
  if (!result.stored) return { ok: false, error: "Esa ya la contestaste.", view: await viewOf(result.partida) };
  return { ok: true, correct, view: await viewOf(result.partida) };
};
