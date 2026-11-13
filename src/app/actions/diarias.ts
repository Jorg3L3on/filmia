"use server";

import { parseTitleGuess } from "@/lib/juegos/diarias/core";
import { answerCuadricula, type CuadriculaOutcome } from "@/lib/juegos/diarias/cuadricula-store";
import { answerDetalle, type DetalleOutcome } from "@/lib/juegos/diarias/detalle-store";
import { answerLinea, type LineaOutcome } from "@/lib/juegos/diarias/linea-store";
import { answerReparto, type RepartoOutcome } from "@/lib/juegos/diarias/reparto-store";
import { requireUserId } from "@/lib/session";

/**
 * Las diarias de FIL-I54. Each action judges one answer on the server and answers with the new
 * view. No revalidatePath: re-rendering the game route mid-game would replace the screen (the
 * same rule as Mayor o menor); a daily that ends refreshes itself into the result.
 */

const validStep = (step: unknown): step is number => Number.isInteger(step) && (step as number) >= 0;

/** Detalle (FIL-I54-1): a guess, or «No sé, ábrelo más» with `guess` null. */
export const answerDetalleStep = async (partidaId: string, step: number, guess: unknown): Promise<DetalleOutcome> => {
  const userId = await requireUserId();
  const parsed = guess == null ? null : parseTitleGuess(guess);
  if (typeof partidaId !== "string" || !validStep(step) || (guess != null && !parsed)) return { ok: false, error: "Respuesta no válida." };
  return answerDetalle(userId, partidaId, step, parsed);
};

/** Línea de tiempo (FIL-I54-2): the current card into gap `gap` (0 = before the first). */
export const placeLineaCard = async (partidaId: string, step: number, gap: number): Promise<LineaOutcome> => {
  const userId = await requireUserId();
  if (typeof partidaId !== "string" || !validStep(step) || !Number.isInteger(gap) || gap < 0) return { ok: false, error: "Respuesta no válida." };
  return answerLinea(userId, partidaId, step, gap);
};

/** Reparto misterioso (FIL-I54-3): a guess, or «Otra pista» with `guess` null. */
export const answerRepartoTry = async (partidaId: string, step: number, guess: unknown): Promise<RepartoOutcome> => {
  const userId = await requireUserId();
  const parsed = guess == null ? null : parseTitleGuess(guess);
  if (typeof partidaId !== "string" || !validStep(step) || (guess != null && !parsed)) return { ok: false, error: "Respuesta no válida." };
  return answerReparto(userId, partidaId, step, parsed);
};

/** La cuadrícula (FIL-I54-4): a film into cell `cell` (0–8, row by row). */
export const answerCuadriculaCell = async (partidaId: string, step: number, cell: number, guess: unknown): Promise<CuadriculaOutcome> => {
  const userId = await requireUserId();
  const parsed = parseTitleGuess(guess);
  if (typeof partidaId !== "string" || !validStep(step) || !Number.isInteger(cell) || !parsed) return { ok: false, error: "Respuesta no válida." };
  return answerCuadricula(userId, partidaId, step, cell, parsed);
};
