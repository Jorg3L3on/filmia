import { createId } from "@paralleldrive/cuid2";
import { and, asc, desc, eq } from "drizzle-orm";
import { db, savedViews } from "@/db";
import {
  cleanViewName,
  MAX_SAVED_VIEWS,
  normalizeViewQuery,
  type SavedView,
  type SavedViewsResult,
} from "@/lib/watchlist-views";

/**
 * Vistas guardadas (FIL-I34-6): every write is scoped to the owner, checks what the sheet
 * already checked, and answers with the whole list.
 */

const columns = { id: true, name: true, query: true, pinned: true } as const;

/** Pinned first, then oldest first: the order they were made in. */
export const loadSavedViews = async (userId: string): Promise<SavedView[]> =>
  db.query.savedViews.findMany({
    where: eq(savedViews.userId, userId),
    columns,
    orderBy: [desc(savedViews.pinned), asc(savedViews.createdAt), asc(savedViews.id)],
  });

const ok = async (userId: string, id?: string): Promise<SavedViewsResult> => ({
  ok: true,
  views: await loadSavedViews(userId),
  ...(id ? { id } : {}),
});

const sameName = (views: readonly SavedView[], name: string, exceptId?: string) =>
  views.some((view) => view.id !== exceptId && view.name.toLocaleLowerCase("es") === name.toLocaleLowerCase("es"));

export const createSavedView = async (
  userId: string,
  input: { name: string; query: string; pin?: boolean },
  now = new Date(),
): Promise<SavedViewsResult> => {
  const name = cleanViewName(input.name);
  if (!name) return { ok: false, error: "Ponle un nombre a la vista." };
  const query = normalizeViewQuery(input.query);
  if (query === "") return { ok: false, error: "Elige un filtro o un orden antes de guardar." };

  const existing = await loadSavedViews(userId);
  if (existing.length >= MAX_SAVED_VIEWS) {
    return { ok: false, error: `Puedes guardar hasta ${MAX_SAVED_VIEWS} vistas. Borra una para seguir.` };
  }
  if (sameName(existing, name)) return { ok: false, error: "Ya tienes una vista con ese nombre." };

  const id = createId();
  const insert = db.insert(savedViews).values({ id, userId, name, query, pinned: Boolean(input.pin), createdAt: now, updatedAt: now });
  if (input.pin) {
    await db.batch([db.update(savedViews).set({ pinned: false }).where(and(eq(savedViews.userId, userId), eq(savedViews.pinned, true))), insert]);
  } else {
    await insert;
  }
  return ok(userId, id);
};

/** «Actualizar vista»: the view now stores what the person is looking at. */
export const updateSavedViewQuery = async (
  userId: string,
  id: string,
  rawQuery: string,
  now = new Date(),
): Promise<SavedViewsResult> => {
  const query = normalizeViewQuery(rawQuery);
  if (query === "") return { ok: false, error: "Elige un filtro o un orden antes de guardar." };
  const updated = await db
    .update(savedViews)
    .set({ query, updatedAt: now })
    .where(and(eq(savedViews.id, id), eq(savedViews.userId, userId)))
    .returning({ id: savedViews.id });
  if (updated.length === 0) return { ok: false, error: "Esa vista ya no existe." };
  return ok(userId, id);
};

/** At most one pinned view: pinning one unpins the others; `pinned: false` just unpins it. */
export const pinSavedView = async (userId: string, id: string, pinned: boolean, now = new Date()): Promise<SavedViewsResult> => {
  const own = await db.query.savedViews.findFirst({
    where: and(eq(savedViews.id, id), eq(savedViews.userId, userId)),
    columns: { id: true },
  });
  if (!own) return { ok: false, error: "Esa vista ya no existe." };
  await db.batch([
    db.update(savedViews).set({ pinned: false }).where(and(eq(savedViews.userId, userId), eq(savedViews.pinned, true))),
    db
      .update(savedViews)
      .set({ pinned, updatedAt: now })
      .where(and(eq(savedViews.id, id), eq(savedViews.userId, userId))),
  ]);
  return ok(userId, id);
};

export const deleteSavedView = async (userId: string, id: string): Promise<SavedViewsResult> => {
  await db.delete(savedViews).where(and(eq(savedViews.id, id), eq(savedViews.userId, userId)));
  return ok(userId);
};
