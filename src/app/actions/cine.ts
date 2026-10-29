"use server";

import { createId } from "@paralleldrive/cuid2";
import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { catalog, db, listItems, lists, titles } from "@/db";
import { mxToday } from "@/lib/cine-core";
import { FIRST_TOP_YEAR, yearTopError, yearTopName, yearTopSlug } from "@/lib/cine-top";
import { remindPremiere, type RemindOutcome } from "@/lib/cine-cuenta-store";
import { requireUserId } from "@/lib/session";

export type SaveYearTopResult = { ok: true; listId: string } | { ok: false; error: string };

/**
 * «Tu top 10 de {año}» (FIL-I17-5): one YEAR_TOP list per user and year, replaced as a whole in
 * the given order. Only movies of that release year the user saw, ten at most — checked here,
 * not trusted from the sheet.
 */
export const saveYearTop = async (year: number, titleIds: string[]): Promise<SaveYearTopResult> => {
  const userId = await requireUserId();
  const currentYear = Number(mxToday().slice(0, 4));
  if (!Number.isInteger(year) || year < FIRST_TOP_YEAR || year > currentYear) {
    return { ok: false, error: "Año no válido." };
  }

  const picks =
    titleIds.length > 0
      ? await db
          .select({
            titleId: titles.id,
            catalogId: titles.catalogId,
            watchedAt: titles.watchedAt,
            year: catalog.year,
            kind: catalog.kind,
          })
          .from(titles)
          .innerJoin(catalog, eq(catalog.id, titles.catalogId))
          .where(and(eq(titles.userId, userId), inArray(titles.id, titleIds)))
      : [];
  const error = yearTopError(
    year,
    titleIds,
    picks.map((pick) => ({ titleId: pick.titleId, watched: pick.watchedAt != null, year: pick.year, kind: pick.kind })),
  );
  if (error) {
    return { ok: false, error };
  }
  // yearTopError checked every id is one of the user's titles.
  const catalogByTitle = new Map(picks.map((pick) => [pick.titleId, pick.catalogId]));

  const slug = yearTopSlug(year);
  const existing = await db.query.lists.findFirst({
    where: and(eq(lists.userId, userId), eq(lists.slug, slug)),
    columns: { id: true, kind: true },
  });
  if (existing && existing.kind !== "YEAR_TOP") {
    return { ok: false, error: "Ya tienes una lista con ese nombre." };
  }

  const listId = existing?.id ?? createId();
  const now = new Date();
  const head = existing
    ? db.update(lists).set({ updatedAt: now }).where(eq(lists.id, listId))
    : db.insert(lists).values({
        id: listId,
        userId,
        name: yearTopName(year),
        description: `Mis películas favoritas estrenadas en ${year}.`,
        kind: "YEAR_TOP",
        slug,
        year,
        createdAt: now,
        updatedAt: now,
      });
  await db.batch([
    head,
    db.delete(listItems).where(eq(listItems.listId, listId)),
    ...(titleIds.length > 0
      ? [
          db.insert(listItems).values(
            titleIds.map((titleId, position) => ({
              listId,
              catalogId: catalogByTitle.get(titleId)!,
              addedByUserId: userId,
              position,
              addedAt: now,
            })),
          ),
        ]
      : []),
  ]);

  revalidatePath("/cine");
  revalidatePath("/listas");
  revalidatePath(`/listas/${listId}`);
  revalidatePath("/perfil");
  return { ok: true, listId };
};

/** «Avísame el día» on a premiere of «Para ti, en sala» (FIL-I26-5). */
export const remindPremiereAction = async (catalogId: string): Promise<RemindOutcome> => {
  const userId = await requireUserId();
  if (typeof catalogId !== "string" || catalogId.length > 64) {
    return { ok: false, error: "Película no válida." };
  }
  const outcome = await remindPremiere(userId, catalogId);
  if (outcome.ok) {
    revalidatePath("/cine");
  }
  return outcome;
};
