"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { isMayorGuess, parseMayorLens } from "@/lib/juegos/mayor/core";
import { answerMayor, type MayorAnswerOutcome } from "@/lib/juegos/mayor/store";
import { readPartida } from "@/lib/juegos/partidas";
import { JUEGOS_PATH } from "@/lib/juegos/core";
import { DUELOS_PATH, parseRetoJuego } from "@/lib/juegos/retos/core";
import { answerGustos, setJuegosNotasFor, startGustosReto, type GustosAnswerOutcome } from "@/lib/juegos/retos/gustos";
import { answerLinkReto, createLinkReto, linkAsMayorView, type LinkAnswerOutcome } from "@/lib/juegos/retos/link";
import { retoFromFreeMayor, startMayorReto } from "@/lib/juegos/retos/mayor";
import { notifyRetado, setRetosPushFor } from "@/lib/juegos/retos/push-store";
import { readRetoFor, RetoError, settleRetoPartida, type RetoRow } from "@/lib/juegos/retos/store";
import {
  answerTrivia,
  askTrivia,
  rivalTriviaAnswers,
  startTriviaReto,
  type TriviaAnswer,
  type TriviaAnswerOutcome,
  type TriviaView,
} from "@/lib/juegos/retos/trivia";
import { requireUserId } from "@/lib/session";

/**
 * Retos uno contra uno (FIL-I53). Every answer is judged on the server; a partida that ends settles
 * its reto (the sender's side sends it and pushes «te retaron», the receiver's closes it).
 */

type Sent = { ok: true; retoId: string } | { ok: false; error: string };

const errorOf = (error: unknown, fallback: string) => (error instanceof RetoError ? error.message : fallback);

/** «Te retaron» after the response, never in its way. */
const pushLater = (reto: RetoRow | null) => {
  if (!reto?.toUserId) return;
  after(() => notifyRetado(reto).catch((error) => console.error("[retos] push failed", error)));
};

const revalidateRetos = () => {
  revalidatePath(JUEGOS_PATH);
  revalidatePath(DUELOS_PATH);
};

/** After a partida of a reto ends: send or close the reto. Safe to call twice. */
const settle = async (userId: string, partidaId: string) => {
  const partida = await readPartida(userId, partidaId);
  if (!partida?.finishedAt) return;
  const sent = await settleRetoPartida(partida);
  pushLater(sent);
  revalidateRetos();
};

/** «Retar a alguien» after a free streak of Mayor o menor: sent right away. */
export const sendMayorStreak = async (partidaId: string, toUserId: string): Promise<Sent> => {
  const userId = await requireUserId();
  if (typeof partidaId !== "string" || typeof toUserId !== "string") return { ok: false, error: "Reto no válido." };
  try {
    const reto = await retoFromFreeMayor({ userId, partidaId, toUserId });
    pushLater(reto);
    revalidateRetos();
    return { ok: true, retoId: reto.id };
  } catch (error) {
    return { ok: false, error: errorOf(error, "No se pudo mandar el reto.") };
  }
};

/** «Mandar un enlace» (FIL-I53-4): Mayor o menor only; the path to share. */
export const makeMayorLink = async (partidaId: string): Promise<{ ok: true; path: string; retoId: string } | { ok: false; error: string }> => {
  const userId = await requireUserId();
  if (typeof partidaId !== "string") return { ok: false, error: "Reto no válido." };
  try {
    const { reto, path } = await createLinkReto(userId, partidaId);
    revalidateRetos();
    return { ok: true, path, retoId: reto.id };
  } catch (error) {
    return { ok: false, error: errorOf(error, "No se pudo crear el enlace.") };
  }
};

/** A duel the sender plays first (trivia, gustos, or a fresh Mayor o menor sequence); also «Revancha». */
export const startDuel = async (juego: string, toUserId: string, options: { lens?: string; rematchOf?: string } = {}): Promise<Sent> => {
  const userId = await requireUserId();
  const id = parseRetoJuego(juego);
  if (!id || typeof toUserId !== "string") return { ok: false, error: "Duelo no válido." };
  let rematchOf: string | null = null;
  if (options.rematchOf) {
    const previous = await readRetoFor(userId, options.rematchOf);
    if (!previous) return { ok: false, error: "No encontramos ese duelo." };
    rematchOf = previous.id;
  }
  try {
    const reto =
      id === "trivia"
        ? await startTriviaReto({ userId, toUserId, rematchOf })
        : id === "gustos"
          ? await startGustosReto({ userId, toUserId, rematchOf })
          : await startMayorReto({ userId, toUserId, lens: parseMayorLens(options.lens) ?? "imdb", rematchOf });
    revalidateRetos();
    return { ok: true, retoId: reto.id };
  } catch (error) {
    return { ok: false, error: errorOf(error, "No se pudo empezar el duelo.") };
  }
};

/** One answer of Mayor o menor inside a reto (muerte súbita). */
export const answerRetoMayor = async (partidaId: string, index: number, guess: string): Promise<MayorAnswerOutcome> => {
  const userId = await requireUserId();
  if (typeof partidaId !== "string" || !Number.isInteger(index) || index < 0 || !isMayorGuess(guess)) {
    return { ok: false, error: "Respuesta no válida." };
  }
  // No revalidatePath of the game route mid-game (FIL-I52 gotcha); the screen refreshes at the end.
  const outcome = await answerMayor(userId, partidaId, index, guess);
  if (outcome.ok && outcome.view.finished) await settle(userId, partidaId);
  return outcome;
};

/** Hands a trivia question over and starts its 15 seconds on the server's clock. */
export const askTriviaQuestion = async (partidaId: string, index: number): Promise<TriviaView | null> => {
  const userId = await requireUserId();
  if (typeof partidaId !== "string" || !Number.isInteger(index) || index < 0) return null;
  return askTrivia(userId, partidaId, index);
};

/** One trivia answer; once answered, also what the rival chose on that same question (if they played it). */
export const answerTriviaQuestion = async (
  partidaId: string,
  index: number,
  choice: number,
): Promise<TriviaAnswerOutcome & { rival?: TriviaAnswer | null }> => {
  const userId = await requireUserId();
  if (typeof partidaId !== "string" || !Number.isInteger(index) || index < 0 || !Number.isInteger(choice) || choice < -1 || choice > 3) {
    return { ok: false, error: "Respuesta no válida." };
  }
  const outcome = await answerTrivia(userId, partidaId, index, choice);
  if (!outcome.ok) return outcome;
  if (outcome.view.finished) await settle(userId, partidaId);
  const reto = await readRetoFor(userId, outcome.view.retoId);
  const rivalPartidaId = reto ? (reto.fromUserId === userId ? reto.toPartidaId : reto.fromPartidaId) : null;
  const rival = (await rivalTriviaAnswers(rivalPartidaId, index + 1))[index] ?? null;
  return { ...outcome, rival };
};

export const answerGustosPair = async (partidaId: string, index: number, pick: string): Promise<GustosAnswerOutcome> => {
  const userId = await requireUserId();
  if (typeof partidaId !== "string" || !Number.isInteger(index) || index < 0 || typeof pick !== "string") {
    return { ok: false, error: "Respuesta no válida." };
  }
  const outcome = await answerGustos(userId, partidaId, index, pick);
  if (outcome.ok && outcome.view.finished) await settle(userId, partidaId);
  return outcome;
};

/** The page of a reto heals a partida that ended without settling (a dropped request). */
export const settleRetoSide = async (retoId: string) => {
  const userId = await requireUserId();
  const reto = await readRetoFor(userId, retoId);
  const partidaId = reto ? (reto.fromUserId === userId ? reto.fromPartidaId : reto.toPartidaId) : null;
  if (partidaId) await settle(userId, partidaId);
};

/** Public: one answer on a link reto, no session (FIL-I53-4). The token is the only key. */
export const answerLinkStep = async (token: string, index: number, guess: string): Promise<LinkAnswerOutcome> => {
  if (typeof token !== "string" || !Number.isInteger(index) || !isMayorGuess(guess)) return { ok: false, error: "Respuesta no válida." };
  return answerLinkReto(token, index, guess);
};

/** The same, in the shape Mayor o menor's screen expects (the page binds the token). */
export const answerLinkAsMayor = async (token: string, _partidaId: string, index: number, guess: string): Promise<MayorAnswerOutcome> => {
  const outcome = await answerLinkStep(token, index, guess);
  if (!outcome.ok) return { ok: false, error: outcome.error, view: outcome.view ? linkAsMayorView(outcome.view) : undefined };
  return { ok: true, correct: outcome.correct, revealed: outcome.revealed, view: linkAsMayorView(outcome.view) };
};

/** Perfil «Te retaron» (FIL-I53-3). */
export const setRetosPush = async (enabled: boolean): Promise<void> => {
  const userId = await requireUserId();
  await setRetosPushFor(userId, enabled === true);
  revalidatePath("/perfil");
};

/** Perfil «Usar mis notas en juegos» (FIL-I53-6): off cancels open Duelos de gustos. */
export const setJuegosNotas = async (enabled: boolean): Promise<void> => {
  const userId = await requireUserId();
  await setJuegosNotasFor(userId, enabled === true);
  revalidatePath("/perfil");
  revalidateRetos();
};

