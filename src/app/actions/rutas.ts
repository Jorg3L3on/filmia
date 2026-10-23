"use server";

import { revalidatePath } from "next/cache";
import { firstRutas, startRutaFromSource, type FirstRutas } from "@/lib/rutas/factories";
import { revealAfterWatch, type RutaReveal } from "@/lib/rutas/reveal";
import { activateRuta as activate, markRutasOffered, parkRuta as park } from "@/lib/rutas/store";
import { requireUserId } from "@/lib/session";

const revalidateRutas = (rutaId?: string) => {
  revalidatePath("/");
  revalidatePath("/rutas");
  if (rutaId) {
    revalidatePath(`/rutas/${rutaId}`);
  }
};

export type StartRutaResult =
  | { ok: true; rutaId: string; status: "activa" | "espera" | "cerrada"; created: boolean }
  | { ok: false; error: string };

/** Start the ruta of an offer (closing screen, the rutas page). The third waits: Hoy keeps two. */
export const startRuta = async (sourceKey: string): Promise<StartRutaResult> => {
  const userId = await requireUserId();
  if (typeof sourceKey !== "string" || sourceKey.length > 120) {
    return { ok: false, error: "Esa ruta no existe." };
  }
  try {
    const created = await startRutaFromSource(userId, sourceKey, "ruta");
    if (!created) {
      return { ok: false, error: "Esa ruta ya no se puede armar." };
    }
    revalidateRutas(created.id);
    return { ok: true, rutaId: created.id, status: created.status, created: created.created };
  } catch {
    return { ok: false, error: "No se pudo empezar la ruta. Inténtalo de nuevo." };
  }
};

/** What «Vi esto» on a ruta card flipped (the reveal sheet), or that the ruta is complete. */
export const rutaAfterWatch = async (rutaId: string, cardId: string): Promise<RutaReveal | null> => {
  const userId = await requireUserId();
  const reveal = await revealAfterWatch(userId, rutaId, cardId);
  revalidateRutas(rutaId);
  return reveal;
};

/** «Dejar para después»: out of Hoy, waiting with no reminders. */
export const parkRuta = async (rutaId: string) => {
  const userId = await requireUserId();
  const ok = await park(userId, rutaId);
  revalidateRutas(rutaId);
  return ok;
};

/** «Seguir esta ruta» on a waiting one; false when Hoy already has two. */
export const activateRuta = async (rutaId: string) => {
  const userId = await requireUserId();
  const ok = await activate(userId, rutaId);
  revalidateRutas(rutaId);
  return ok;
};

/** The Bienvenida's last step (R6): the first ruta and two others. Builds nothing yet. */
export const loadFirstRutas = async (): Promise<FirstRutas> => {
  const userId = await requireUserId();
  try {
    return await firstRutas(userId);
  } catch {
    return { main: null, alternatives: [] };
  }
};

/** «Empezar esta ruta» in the Bienvenida. */
export const startFirstRuta = async (sourceKey: string): Promise<StartRutaResult> => {
  const userId = await requireUserId();
  try {
    const created = await startRutaFromSource(userId, sourceKey, "bienvenida");
    if (!created) {
      return { ok: false, error: "Esa ruta ya no se puede armar." };
    }
    revalidateRutas(created.id);
    return { ok: true, rutaId: created.id, status: created.status, created: created.created };
  } catch {
    return { ok: false, error: "No se pudo empezar la ruta. Inténtalo de nuevo." };
  }
};

/** «Entrar sin ruta»: nothing is built, and Hoy does not offer it again. */
export const declineFirstRuta = async () => {
  const userId = await requireUserId();
  await markRutasOffered(userId);
};
