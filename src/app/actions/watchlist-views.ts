"use server";

import {
  createSavedView,
  deleteSavedView,
  pinSavedView,
  updateSavedViewQuery,
} from "@/lib/saved-views-store";
import type { SavedViewsResult } from "@/lib/watchlist-views";
import { requireUserId } from "@/lib/session";

// Every export of a "use server" file is callable with any arguments: check the shapes here.
const text = (value: unknown, max: number) => (typeof value === "string" ? value.slice(0, max) : "");

const QUERY_MAX = 2000;
const ID_MAX = 64;
const BAD_INPUT: SavedViewsResult = { ok: false, error: "No pudimos guardar la vista." };

/** «Guardar la vista actual» / «Guardar como…» (FIL-I34-6). */
export const saveWatchlistView = async (name: unknown, query: unknown, pin: unknown): Promise<SavedViewsResult> => {
  const userId = await requireUserId();
  return createSavedView(userId, { name: text(name, 200), query: text(query, QUERY_MAX), pin: pin === true });
};

/** «Actualizar vista». */
export const updateWatchlistView = async (id: unknown, query: unknown): Promise<SavedViewsResult> => {
  const userId = await requireUserId();
  const viewId = text(id, ID_MAX);
  return viewId ? updateSavedViewQuery(userId, viewId, text(query, QUERY_MAX)) : BAD_INPUT;
};

/** The pin in the Vistas sheet: the pinned view is the scope bar's third cell. */
export const pinWatchlistView = async (id: unknown, pinned: unknown): Promise<SavedViewsResult> => {
  const userId = await requireUserId();
  const viewId = text(id, ID_MAX);
  return viewId ? pinSavedView(userId, viewId, pinned === true) : BAD_INPUT;
};

export const deleteWatchlistView = async (id: unknown): Promise<SavedViewsResult> => {
  const userId = await requireUserId();
  const viewId = text(id, ID_MAX);
  return viewId ? deleteSavedView(userId, viewId) : BAD_INPUT;
};
