"use server";

import { setTitleRating } from "@/app/actions/titles";
import { markTitleWatched } from "@/app/actions/watchlist";
import { upsertTitleFromTmdbForUser, type AddTitleFromTmdbInput } from "@/lib/add-title-from-tmdb";
import { revalidateSearchAddSurfaces } from "@/lib/revalidate-surfaces";
import { requireUserId } from "@/lib/session";

export type TitlePreviewActionResult = { ok: true; titleId: string } | { ok: false; error: string };

type TmdbSnapshot = Pick<AddTitleFromTmdbInput, "tmdbId" | "kind" | "name" | "originalName" | "year" | "posterPath">;

const failure = (caught: unknown): TitlePreviewActionResult => ({
  ok: false,
  error: caught instanceof Error ? caught.message : "No se pudo guardar.",
});

/**
 * «Vi esto» from a ficha preview (FIL-I8): the Title is born watched on the
 * sheet's day, then the sheet's nota, reseña and «Dónde la vi» land on it.
 * Never a Title without state: it exists only once the viewing is saved.
 */
export const markTmdbTitleWatched = async (
  snapshot: TmdbSnapshot,
  formData: FormData,
): Promise<TitlePreviewActionResult> => {
  const userId = await requireUserId();
  try {
    const watchedAt = formData.get("watchedAt");
    const added = await upsertTitleFromTmdbForUser(userId, {
      ...snapshot,
      destination: "watched",
      watchedAt: typeof watchedAt === "string" ? watchedAt : null,
    });
    if (!added.ok) {
      return added;
    }
    await markTitleWatched(added.titleId, formData);
    revalidateSearchAddSurfaces(added.titleId, { watched: true });
    return { ok: true, titleId: added.titleId };
  } catch (caught) {
    return failure(caught);
  }
};

/** «Nota» from a ficha preview: the Title is born with the score. */
export const rateTmdbTitle = async (
  snapshot: TmdbSnapshot,
  formData: FormData,
): Promise<TitlePreviewActionResult> => {
  const userId = await requireUserId();
  try {
    const added = await upsertTitleFromTmdbForUser(userId, snapshot);
    if (!added.ok) {
      return added;
    }
    await setTitleRating(added.titleId, formData);
    revalidateSearchAddSurfaces(added.titleId, {});
    return { ok: true, titleId: added.titleId };
  } catch (caught) {
    return failure(caught);
  }
};
