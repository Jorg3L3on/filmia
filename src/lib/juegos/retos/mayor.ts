import { createId } from "@paralleldrive/cuid2";
import { MAYOR_ID, MAYOR_LENSES, stepsOf, type MayorLensId } from "@/lib/juegos/mayor/core";
import {
  createRetoMayorPartida,
  drawMayorSequence,
  mayorSequenceOf,
  viewMayorPartida,
  type MayorSources,
  type MayorView,
} from "@/lib/juegos/mayor/store";
import { readPartida } from "@/lib/juegos/partidas";
import { claimToPartida, createReto, readReto, RetoError, setFromPartida, type RetoRow } from "@/lib/juegos/retos/store";

/**
 * Mayor o menor contra alguien (FIL-I53-1/2): muerte súbita over the same sequence. Two ways in:
 * a finished free streak is sent as it is (the sender's side is already played), or a fresh
 * sequence is drawn and the sender plays it first (Revancha).
 */

type MayorRetoContent = { sequence: string[] };

const lensOf = (reto: Pick<RetoRow, "lens">): MayorLensId =>
  MAYOR_LENSES[reto.lens as MayorLensId] ? (reto.lens as MayorLensId) : "imdb";

export const mayorRetoSequence = (reto: Pick<RetoRow, "content">) =>
  ((reto.content as MayorRetoContent | null)?.sequence ?? []).filter((id) => typeof id === "string");

/** A finished free streak of the person, ready to send: its lens, sequence and score. */
export const readSendableMayor = async (userId: string, partidaId: string) => {
  const partida = await readPartida(userId, partidaId);
  if (!partida || partida.juego !== MAYOR_ID || partida.mode !== "libre" || !partida.finishedAt) return null;
  const sequence = mayorSequenceOf(partida);
  const lens = lensOf(partida);
  if (stepsOf(sequence, lens) < 1) return null;
  return { partida, lens, sequence, score: partida.score, answers: (partida.answers as unknown[]).map((answer) => answer === true) };
};

/** «Retar a alguien» after a free streak: the other person (or a link) gets the same sequence. */
export const retoFromFreeMayor = async (input: {
  userId: string;
  partidaId: string;
  toUserId: string | null;
  linkTokenHash?: string | null;
  now?: Date;
}) => {
  const sendable = await readSendableMayor(input.userId, input.partidaId);
  if (!sendable) throw new RetoError("Esa racha no se puede mandar.", "partida");
  return createReto({
    fromUserId: input.userId,
    toUserId: input.toUserId,
    juego: "mayor",
    lens: sendable.lens,
    seed: sendable.partida.id,
    content: { sequence: sendable.sequence } satisfies MayorRetoContent,
    fromPartidaId: sendable.partida.id,
    sent: true,
    linkTokenHash: input.linkTokenHash ?? null,
    now: input.now,
  });
};

/** A reto with a fresh sequence that the sender plays first; sent when their streak ends. */
export const startMayorReto = async (input: {
  userId: string;
  toUserId: string;
  lens: MayorLensId;
  rematchOf?: string | null;
  now?: Date;
  sources?: MayorSources;
}) => {
  const seed = createId();
  const sequence = await drawMayorSequence(input.lens, seed, input.sources);
  if (stepsOf(sequence, input.lens) < 1) throw new RetoError("No hay suficientes películas para ese dato.", "datos");
  const reto = await createReto({
    fromUserId: input.userId,
    toUserId: input.toUserId,
    juego: "mayor",
    lens: input.lens,
    seed,
    content: { sequence } satisfies MayorRetoContent,
    sent: false,
    rematchOf: input.rematchOf ?? null,
    now: input.now,
  });
  const partida = await createRetoMayorPartida({ userId: input.userId, lens: input.lens, sequence, retoId: reto.id, side: "from", now: input.now });
  await setFromPartida(reto.id, partida.id);
  return { ...reto, fromPartidaId: partida.id };
};

/**
 * The person's side of a Mayor o menor reto: the sender's partida, or the receiver's (made on first
 * open over exactly the sender's sequence; two tabs get the same one).
 */
export const openMayorRetoSide = async (userId: string, reto: RetoRow, now = new Date()): Promise<MayorView | null> => {
  if (reto.fromUserId === userId) return reto.fromPartidaId ? viewMayorPartida(userId, reto.fromPartidaId) : null;
  if (reto.toUserId !== userId) return null;
  if (reto.toPartidaId) return viewMayorPartida(userId, reto.toPartidaId);
  const partida = await createRetoMayorPartida({ userId, lens: lensOf(reto), sequence: mayorRetoSequence(reto), retoId: reto.id, side: "to", now });
  if (await claimToPartida(reto.id, partida.id)) return viewMayorPartida(userId, partida.id);
  // Another tab won: show that partida (this one stays unused).
  const fresh = await readReto(reto.id);
  return fresh?.toPartidaId ? viewMayorPartida(userId, fresh.toPartidaId) : null;
};
