import { eq, inArray } from "drizzle-orm";
import { db, juegoPartidas, users } from "@/db";
import {
  headToHead,
  initialOf,
  isRetoOpen,
  parseRetoJuego,
  retoNames,
  retoOutcome,
  type HeadToHead,
  type RetoJuegoId,
} from "@/lib/juegos/retos/core";
import type { GustosAnswer } from "@/lib/juegos/retos/gustos";
import { retosBetween, type RetoRow } from "@/lib/juegos/retos/store";
import type { TriviaAnswer } from "@/lib/juegos/retos/trivia";
import type { TriviaQuestion } from "@/lib/juegos/retos/trivia-core";

/**
 * The closing screen shared by the three duels (FIL-I53-7, board D-7-resultado): both scores, the
 * detail per question or pair, the history between the two and whether a rematch is possible. The
 * other side's detail is shown only once the person finished their own side.
 */

export type RetoSideSummary = {
  name: string;
  initial: string;
  /** Null while that side is not finished. */
  score: number | null;
  /** Right/wrong per step (Mayor o menor, gustos) or per question (trivia). */
  marks: boolean[];
};

export type RetoDetailRow = { label: string; mine: string; theirs: string; mineOk: boolean | null; theirsOk: boolean | null };

export type RetoResult = {
  retoId: string;
  juego: RetoJuegoId;
  lens: string;
  status: string;
  /** «abierto» while the other person still has to play; «jugado» when both did. */
  state: "esperando" | "terminado" | "vencido" | "cancelado";
  me: RetoSideSummary;
  other: RetoSideSummary & { userId: string | null };
  outcome: "ganaste" | "perdiste" | "empate" | null;
  detail: RetoDetailRow[];
  h2h: HeadToHead | null;
  /** Revancha: another reto toward the same account (not for a link, not after a cancel). */
  canRematch: boolean;
  expiresAt: Date;
};

type Partida = typeof juegoPartidas.$inferSelect;

const readPartidas = async (ids: (string | null)[]) => {
  const present = ids.filter((id): id is string => Boolean(id));
  if (present.length === 0) return new Map<string, Partida>();
  const rows = await db.select().from(juegoPartidas).where(inArray(juegoPartidas.id, present));
  return new Map(rows.map((row) => [row.id, row]));
};

const marksOf = (juego: RetoJuegoId, answers: unknown[]) =>
  answers.map((answer) =>
    juego === "mayor" ? answer === true : juego === "trivia" ? (answer as TriviaAnswer).points > 0 : (answer as GustosAnswer).correct === true,
  );

const linkSide = (reto: RetoRow): { score: number | null; marks: boolean[] } => {
  const result = reto.linkResult as { answers?: boolean[]; score?: number; finishedAt?: string | null } | null;
  return { score: result?.finishedAt ? (result.score ?? 0) : null, marks: (result?.answers ?? []).map((answer) => answer === true) };
};

/** The result of a reto from `userId`'s side (sender or receiver), or null if it is not theirs. */
export const loadRetoResult = async (userId: string, reto: RetoRow, now = new Date()): Promise<RetoResult | null> => {
  const juego = parseRetoJuego(reto.juego);
  if (!juego || (reto.fromUserId !== userId && reto.toUserId !== userId)) return null;
  const mineIsFrom = reto.fromUserId === userId;
  const otherId = mineIsFrom ? reto.toUserId : reto.fromUserId;
  const partidas = await readPartidas([reto.fromPartidaId, reto.toPartidaId]);
  const fromP = reto.fromPartidaId ? partidas.get(reto.fromPartidaId) : undefined;
  const toP = reto.toPartidaId ? partidas.get(reto.toPartidaId) : undefined;
  const people = await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, [userId, ...(otherId ? [otherId] : [])]));
  const names = retoNames(people);

  const sideOf = (partida: Partida | undefined) => ({
    score: partida?.finishedAt ? partida.score : null,
    marks: partida ? marksOf(juego, partida.answers as unknown[]) : [],
  });
  const fromSide = sideOf(fromP);
  const toSide = reto.toUserId ? sideOf(toP) : linkSide(reto);
  const mineSide = mineIsFrom ? fromSide : toSide;
  const theirSide = mineIsFrom ? toSide : fromSide;
  const myName = "Tú";
  const theirName = otherId ? (names.get(otherId) ?? "Alguien") : "Tu enlace";
  const iFinished = mineSide.score != null;

  const state: RetoResult["state"] =
    reto.status === "jugado" ? "terminado" : reto.status === "cancelado" ? "cancelado" : isRetoOpen(reto, now) ? "esperando" : "vencido";
  const both = fromSide.score != null && toSide.score != null;
  let outcome: RetoResult["outcome"] = null;
  if (both && state === "terminado") {
    const result = retoOutcome(fromSide.score!, toSide.score!);
    outcome = result === "empate" ? "empate" : (result === "from") === mineIsFrom ? "ganaste" : "perdiste";
  }

  // The other side's detail stays hidden until the person finished theirs.
  const showTheirs = iFinished;
  const detail: RetoDetailRow[] = [];
  if (juego === "trivia") {
    const questions = ((reto.content as { questions?: TriviaQuestion[] }).questions ?? []) as TriviaQuestion[];
    const mineAnswers = ((mineIsFrom ? fromP : toP)?.answers ?? []) as TriviaAnswer[];
    const theirAnswers = ((mineIsFrom ? toP : fromP)?.answers ?? []) as TriviaAnswer[];
    questions.forEach((question, index) => {
      const mine = mineAnswers[index];
      const theirs = showTheirs ? theirAnswers[index] : undefined;
      detail.push({
        label: question.label,
        mine: mine ? String(mine.points) : "—",
        theirs: theirs ? String(theirs.points) : "—",
        mineOk: mine ? mine.points > 0 : null,
        theirsOk: theirs ? theirs.points > 0 : null,
      });
    });
  }

  let h2h: HeadToHead | null = null;
  if (otherId) h2h = headToHead(await retosBetween(userId, otherId), userId);

  return {
    retoId: reto.id,
    juego,
    lens: reto.lens,
    status: reto.status,
    state,
    me: { name: myName, initial: initialOf(names.get(userId) ?? "T"), score: mineSide.score, marks: mineSide.marks },
    other: {
      userId: otherId,
      name: theirName,
      initial: initialOf(theirName),
      score: showTheirs ? theirSide.score : null,
      marks: showTheirs ? theirSide.marks : [],
    },
    outcome,
    detail,
    h2h,
    canRematch: Boolean(otherId) && state !== "cancelado" && iFinished,
    expiresAt: reto.expiresAt,
  };
};

/** The sender's name and score, for the receiver's play screen (rival bar, «Ana hizo 410»). */
export const loadRival = async (reto: RetoRow, userId: string) => {
  const rivalId = reto.fromUserId === userId ? reto.toUserId : reto.fromUserId;
  const rivalPartidaId = reto.fromUserId === userId ? reto.toPartidaId : reto.fromPartidaId;
  if (!rivalId) return null;
  const [person, partida] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, rivalId), columns: { id: true, name: true } }),
    rivalPartidaId ? db.query.juegoPartidas.findFirst({ where: eq(juegoPartidas.id, rivalPartidaId) }) : null,
  ]);
  const name = retoNames(person ? [person] : []).get(rivalId) ?? "Alguien";
  return {
    name,
    initial: initialOf(name),
    finished: partida?.finishedAt != null,
    score: partida?.finishedAt ? partida.score : null,
    partidaId: rivalPartidaId,
  };
};
