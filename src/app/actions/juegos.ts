"use server";

import { revalidatePath } from "next/cache";
import { JUEGOS_PATH, parseJuegosEntry, TANDA_PATH } from "@/lib/juegos/core";
import { isMayorGuess, parseMayorLens } from "@/lib/juegos/mayor/core";
import { answerMayor, startFreeMayor, type MayorAnswerOutcome, type MayorView } from "@/lib/juegos/mayor/store";
import { setJuegosPushFor } from "@/lib/juegos/push-store";
import { recordJuegosOpened } from "@/lib/juegos/store";
import { isSeenAnswer, isTandaAnswer } from "@/lib/juegos/tanda/core";
import {
  answerTanda,
  dealNextTanda,
  tandaCorte,
  undoLastTanda,
  type NextTandaOutcome,
  type TandaCorte,
  type TandaOutcome,
} from "@/lib/juegos/tanda/store";
import { requireUserId } from "@/lib/session";

/** A visit to the portada: Hoy's «nuevo» dot goes off (FIL-I50-2). */
export const markJuegosOpened = async (entry: string | null): Promise<void> => {
  const userId = await requireUserId();
  await recordJuegosOpened(userId, parseJuegosEntry(entry));
  revalidatePath("/");
};

const revalidateTanda = (seen: boolean) => {
  revalidatePath("/");
  revalidatePath(JUEGOS_PATH);
  revalidatePath(TANDA_PATH);
  if (seen) {
    revalidatePath("/perfil");
  }
};

/** One card of La tanda (FIL-I50-3). */
export const answerTandaCard = async (catalogId: string, choice: string): Promise<TandaOutcome> => {
  const userId = await requireUserId();
  if (typeof catalogId !== "string" || !isTandaAnswer(choice)) {
    return { ok: false, error: "Respuesta no válida." };
  }
  const outcome = await answerTanda(userId, catalogId, choice);
  if (outcome.ok) {
    revalidateTanda(isSeenAnswer(choice));
  }
  return outcome;
};

/** Deshacer: the week's last answer, and the title it created. */
export const undoTandaAnswer = async () => {
  const userId = await requireUserId();
  const outcome = await undoLastTanda(userId);
  if (outcome.ok) {
    revalidateTanda(true);
  }
  return outcome;
};

/** «Otra tanda» (FIL-I50-7): ten more, as many times as the person wants. */
export const nextTanda = async (): Promise<NextTandaOutcome> => {
  const userId = await requireUserId();
  const outcome = await dealNextTanda(userId).catch(() => ({ ok: false as const, error: "No pudimos repartir otra tanda." }));
  if (outcome.ok) {
    revalidatePath(JUEGOS_PATH);
  }
  return outcome;
};

/** Corte: the score and «lo que cambió», read after the last card. */
export const loadTandaCorte = async (): Promise<TandaCorte> => {
  const userId = await requireUserId();
  return tandaCorte(userId);
};

/** Perfil «Avisos de Juegos» (FIL-I50-5): only this switch, never «Avisos de Quiero ver». */
export const setJuegosPush = async (enabled: boolean): Promise<void> => {
  const userId = await requireUserId();
  await setJuegosPushFor(userId, enabled === true);
  revalidatePath("/perfil");
};

// ---------------------------------------------------------------------------
// Mayor o menor (FIL-I52)
// ---------------------------------------------------------------------------

/** «Otra vez»: a new free streak in that lens (the unfinished one, if any, is closed). */
export const startMayorFree = async (lens: string): Promise<{ ok: true; view: MayorView } | { ok: false; error: string }> => {
  const userId = await requireUserId();
  const parsed = parseMayorLens(lens);
  if (!parsed) return { ok: false, error: "Ese dato no existe." };
  const view = await startFreeMayor(userId, parsed).catch(() => null);
  return view ? { ok: true, view } : { ok: false, error: "No hay suficientes películas para jugar con ese dato." };
};

/** One answer: the server judges it and only then reveals the hidden value. */
export const answerMayorStep = async (partidaId: string, index: number, guess: string): Promise<MayorAnswerOutcome> => {
  const userId = await requireUserId();
  if (typeof partidaId !== "string" || !Number.isInteger(index) || index < 0 || !isMayorGuess(guess)) {
    return { ok: false, error: "Respuesta no válida." };
  }
  // No revalidatePath: it would re-render this route mid-game (a new partida over the closing
  // panel). Extras and Mayor o menor are force-dynamic; the daily refreshes itself when it ends.
  return answerMayor(userId, partidaId, index, guess);
};
