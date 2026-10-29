"use server";

import { revalidatePath } from "next/cache";
import { isVisteAnswer } from "@/lib/piezas/core";
import { answerViste as answer, dealMoreViste, type VisteCard, type VisteOutcome } from "@/lib/piezas/viste";
import { requireUserId } from "@/lib/session";

/** One answer of «¿Las viste?»; the last one comes back with what changed. */
export const answerViste = async (catalogId: string, choice: string): Promise<VisteOutcome> => {
  const userId = await requireUserId();
  if (typeof catalogId !== "string" || !isVisteAnswer(choice)) {
    return { ok: false, error: "Respuesta no válida." };
  }
  const outcome = await answer(userId, catalogId, choice);
  if (outcome.ok) {
    revalidatePath("/");
    revalidatePath("/las-viste");
    if (choice !== "no") {
      revalidatePath("/perfil");
    }
  }
  return outcome;
};

/** Three more cards of «¿Las viste?» (no daily limit); empty when none are left. */
export const moreViste = async (): Promise<VisteCard[]> => {
  const userId = await requireUserId();
  return dealMoreViste(userId).catch(() => []);
};
