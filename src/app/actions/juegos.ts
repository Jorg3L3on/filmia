"use server";

import { revalidatePath } from "next/cache";
import { JUEGOS_PATH, parseJuegosEntry, TANDA_PATH } from "@/lib/juegos/core";
import { setJuegosPushFor } from "@/lib/juegos/push-store";
import { recordJuegosOpened } from "@/lib/juegos/store";
import { isSeenAnswer, isTandaAnswer } from "@/lib/juegos/tanda/core";
import { answerTanda, tandaCorte, undoLastTanda, type TandaCorte, type TandaOutcome } from "@/lib/juegos/tanda/store";
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
