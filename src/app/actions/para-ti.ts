"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, titles } from "@/db";
import { forgetUserAffinity } from "@/lib/affinity-store";
import { catalogExists, PARA_TI_DISMISS_KIND, PARA_TI_LENS } from "@/lib/para-ti/store";
import { revalidateWatchlistSurfaces } from "@/lib/revalidate-surfaces";
import { requireUserId } from "@/lib/session";
import { removeFromWatchlistFor } from "@/lib/title-writes";
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
  revalidatePath("/");
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
  revalidatePath("/");
  return { ok: true };
};

/**
 * «Deshacer» on «Guardar» (FIL-I60-6): out of Quiero ver again. When the save had just created the
 * person's Title (and nothing was added to it since: unwatched, unrated), the Title goes too, so the
 * film is back on the shelf; a Title they already had only leaves Quiero ver.
 */
export const undoSaveParaTi = async (titleId: string, created: boolean): Promise<ParaTiActionResult> => {
  const userId = await requireUserId();
  if (typeof titleId !== "string" || !CATALOG_ID.test(titleId)) {
    return { ok: false, error: "No encontramos ese título." };
  }
  const owned = await db.query.titles.findFirst({
    where: and(eq(titles.id, titleId), eq(titles.userId, userId)),
    columns: { id: true },
  });
  if (!owned) {
    return { ok: false, error: "No encontramos ese título." };
  }
  await removeFromWatchlistFor(userId, titleId);
  if (created) {
    await db
      .delete(titles)
      .where(and(eq(titles.id, titleId), eq(titles.userId, userId), isNull(titles.watchedAt), isNull(titles.rating)));
  }
  forgetUserAffinity(userId);
  revalidateWatchlistSurfaces(titleId);
  revalidatePath("/para-ti");
  return { ok: true };
};
