"use server";

import { JUEGOS_PATH } from "@/lib/juegos/core";
import { parseGuess } from "@/lib/juegos/estrenos/core";
import { EstrenoClosedError, loadEstrenos, savePronostico, type EstrenoCard } from "@/lib/juegos/estrenos/store";
import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/session";

export type SavePronosticoOutcome = { ok: true; card: EstrenoCard } | { ok: false; error: string };

/**
 * Quiniela de estrenos (FIL-I55-1): save or change a forecast. The answer carries the card again,
 * now with others' forecasts: they never reached the client before this save.
 */
export const savePronosticoAction = async (catalogId: string, guess: number): Promise<SavePronosticoOutcome> => {
  const userId = await requireUserId();
  const value = parseGuess(guess);
  if (typeof catalogId !== "string" || value == null) return { ok: false, error: "Pronóstico no válido." };
  try {
    await savePronostico({ userId, catalogId, guess: value });
  } catch (error) {
    if (error instanceof EstrenoClosedError) return { ok: false, error: error.message };
    console.error("[estrenos] save failed", error);
    return { ok: false, error: "No se pudo guardar. Intenta otra vez." };
  }
  revalidatePath(JUEGOS_PATH);
  const card = (await loadEstrenos(userId)).find((item) => item.catalogId === catalogId);
  return card ? { ok: true, card } : { ok: false, error: "No se pudo leer el estreno." };
};

