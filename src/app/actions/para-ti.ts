"use server";

import { revalidatePath } from "next/cache";
import { forgetUserAffinity } from "@/lib/affinity-store";
import { catalogExists, PARA_TI_DISMISS_KIND, PARA_TI_LENS } from "@/lib/para-ti/store";
import { requireUserId } from "@/lib/session";
import { deleteLatestPickEvent, recordPickEvents, scheduleTonightRecompute } from "@/lib/tonight-store";

export type ParaTiActionResult = { ok: true } | { ok: false; error: string };

const CATALOG_ID = /^[a-z0-9_-]{4,64}$/i;

/**
 * «No me interesa» on a Para ti title (FIL-I60-3): a `less_like` PickEvent on the film for the
 * signed-in person only. It never shows in Para ti again, and Hoy's recommendations drop it too.
 */
export const dismissParaTi = async (catalogId: string): Promise<ParaTiActionResult> => {
  const userId = await requireUserId();
  if (typeof catalogId !== "string" || !CATALOG_ID.test(catalogId) || !(await catalogExists(catalogId))) {
    return { ok: false, error: "No encontramos ese título." };
  }
  await recordPickEvents(userId, [{ catalogId, kind: PARA_TI_DISMISS_KIND, lens: PARA_TI_LENS }]);
  forgetUserAffinity(userId);
  scheduleTonightRecompute(userId);
  revalidatePath("/para-ti");
  return { ok: true };
};

/** «Deshacer»: removes the person's own latest dismissal of that film, nobody else's. */
export const undoDismissParaTi = async (catalogId: string): Promise<ParaTiActionResult> => {
  const userId = await requireUserId();
  if (typeof catalogId !== "string" || !CATALOG_ID.test(catalogId)) {
    return { ok: false, error: "No encontramos ese título." };
  }
  const removed = await deleteLatestPickEvent(userId, PARA_TI_DISMISS_KIND, { catalogId });
  if (!removed) {
    return { ok: false, error: "Ya no estaba descartado." };
  }
  forgetUserAffinity(userId);
  scheduleTonightRecompute(userId);
  revalidatePath("/para-ti");
  return { ok: true };
};
