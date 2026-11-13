import { and, eq, gte, inArray, isNotNull } from "drizzle-orm";
import { catalog, db } from "@/db";
import { DIARIA_MIN_VOTES, diariaNumber } from "@/lib/juegos/diarias/core";
import {
  buildLineaRound,
  fitsGap,
  LINEA_CARDS,
  LINEA_ID,
  LINEA_LIVES,
  lineaState,
  parseLineaAnswers,
  type LineaAnswer,
  type LineaCandidate,
  type LineaRound,
} from "@/lib/juegos/diarias/linea";
import { appendAnswer, collectStrings, openDiaria, readOwnPartida, recentRoundContents, ShortPoolError } from "@/lib/juegos/diarias/store";
import type { PartidaRow } from "@/lib/juegos/partidas";

/**
 * Línea de tiempo on the database (FIL-I54-2). The server keeps the round and judges each
 * placement; the card to place travels with its name and poster, never its year, until placed.
 */

export type LineaSources = { pool: () => Promise<LineaCandidate[]> };

export const loadLineaPool = (): Promise<LineaCandidate[]> =>
  db
    .select({ id: catalog.id, year: catalog.year, posterPath: catalog.posterPath, imdbVotes: catalog.imdbVotes })
    .from(catalog)
    .where(and(eq(catalog.kind, "MOVIE"), isNotNull(catalog.posterPath), isNotNull(catalog.year), gte(catalog.imdbVotes, DIARIA_MIN_VOTES)));

const defaultSources: LineaSources = { pool: loadLineaPool };

export type LineaFilm = { name: string; posterPath: string | null };

export type LineaView = {
  partidaId: string;
  day: string;
  number: number;
  step: number;
  /** The line, oldest first, every card with its year. */
  line: Array<LineaFilm & { year: number; ok: boolean | null }>;
  /** The card to place: no year. */
  card: LineaFilm | null;
  /** 1-based number of that card («carta 5 de 8»). */
  cardNumber: number;
  lives: number;
  maxLives: number;
  marks: boolean[];
  score: number;
  total: number;
  finished: boolean;
};

const roundOf = (partida: PartidaRow) => partida.content as LineaRound;

const viewOf = async (partida: PartidaRow): Promise<LineaView> => {
  const round = roundOf(partida);
  const state = lineaState(round, parseLineaAnswers(partida.answers as unknown[]));
  const ids = [...state.placed.map((item) => round.cards[item.card]!.catalogId), ...(state.current == null ? [] : [round.cards[state.current]!.catalogId])];
  const rows = await db.select({ id: catalog.id, name: catalog.name, posterPath: catalog.posterPath }).from(catalog).where(inArray(catalog.id, ids));
  const byId = new Map(rows.map((row) => [row.id, row]));
  const film = (cardIndex: number): LineaFilm => {
    const row = byId.get(round.cards[cardIndex]!.catalogId);
    return { name: row?.name ?? "Película", posterPath: row?.posterPath ?? null };
  };
  return {
    partidaId: partida.id,
    day: partida.day ?? "",
    number: diariaNumber(LINEA_ID, partida.day ?? ""),
    step: (partida.answers as unknown[]).length,
    line: state.placed.map((item) => ({ ...film(item.card), year: item.year, ok: item.ok })),
    card: state.current == null ? null : film(state.current),
    cardNumber: state.current ?? LINEA_CARDS,
    lives: state.lives,
    maxLives: LINEA_LIVES,
    marks: state.marks,
    score: state.score,
    total: LINEA_CARDS,
    finished: partida.finishedAt != null || state.finished,
  };
};

export type LineaOpen = { status: "ok"; view: LineaView } | { status: "unavailable"; day: string };

export const openLinea = async (userId: string, now = new Date(), sources = defaultSources): Promise<LineaOpen> => {
  const opened = await openDiaria({
    userId,
    juego: LINEA_ID,
    now,
    build: async (seed, day) => {
      const exclude = collectStrings(await recentRoundContents(LINEA_ID, day), "catalogId");
      const round = buildLineaRound({ pool: await sources.pool(), seed, exclude });
      if (!round) throw new ShortPoolError();
      return round;
    },
  });
  return opened.status === "ok" ? { status: "ok", view: await viewOf(opened.partida) } : opened;
};

export type LineaOutcome = { ok: true; correct: boolean; year: number; view: LineaView } | { ok: false; error: string; view?: LineaView };

/** Places the current card in gap `gap` of the line as the person saw it (`step` answers so far). */
export const answerLinea = async (userId: string, partidaId: string, step: number, gap: number, now = new Date()): Promise<LineaOutcome> => {
  const partida = await readOwnPartida(userId, LINEA_ID, partidaId);
  if (!partida) return { ok: false, error: "No encontramos esa partida." };
  const round = roundOf(partida);
  const answers = parseLineaAnswers(partida.answers as unknown[]);
  const state = lineaState(round, answers);
  if (partida.finishedAt || state.current == null || step !== (partida.answers as unknown[]).length) {
    return { ok: false, error: "Esa ya la colocaste.", view: await viewOf(partida) };
  }
  if (!Number.isInteger(gap) || gap < 0 || gap > state.placed.length) return { ok: false, error: "Ese hueco no existe.", view: await viewOf(partida) };
  const year = round.cards[state.current]!.year;
  const correct = fitsGap(state.placed, gap, year);
  const answer: LineaAnswer = { c: state.current, g: gap, ok: correct };
  const next = lineaState(round, [...answers, answer]);
  const result = await appendAnswer({ userId, partida, answer, score: next.score, finished: next.finished, now });
  if (!result.stored) return { ok: false, error: "Esa ya la colocaste.", view: await viewOf(result.partida) };
  return { ok: true, correct, year, view: await viewOf(result.partida) };
};
