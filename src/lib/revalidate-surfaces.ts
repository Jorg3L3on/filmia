import { revalidatePath } from "next/cache";

export const revalidateTitlePages = (titleId: string) => {
  revalidatePath(`/titulos/${titleId}`);
  revalidatePath(`/titulos/${titleId}/editar`);
};

export const revalidateWatchlistSurfaces = (titleId?: string) => {
  revalidatePath("/watchlist");
  if (titleId) {
    revalidateTitlePages(titleId);
  }
};

export const revalidateDiarySurfaces = (titleId: string) => {
  revalidatePath("/");
  revalidatePath("/watchlist");
  revalidateTitlePages(titleId);
};

export const revalidateRatingSurfaces = (titleId: string) => {
  revalidatePath("/");
  revalidateTitlePages(titleId);
};

export const revalidateSearchAddSurfaces = (
  titleId: string,
  opts: { watchlist?: boolean; watched?: boolean },
) => {
  revalidatePath("/buscar");
  revalidateTitlePages(titleId);
  if (opts.watchlist || opts.watched) {
    revalidatePath("/watchlist");
  }
  if (opts.watched) {
    revalidatePath("/");
  }
};

export const revalidateListMembership = (listId: string, titleId: string) => {
  revalidatePath("/listas");
  revalidatePath(`/listas/${listId}`);
  revalidatePath(`/listas/${listId}/editar`);
  revalidateTitlePages(titleId);
};

export const revalidateCatalogSurfaces = (titleId?: string) => {
  revalidatePath("/");
  revalidatePath("/listas");
  revalidatePath("/watchlist");
  revalidatePath("/buscar");
  revalidatePath("/tags");
  if (titleId) {
    revalidateTitlePages(titleId);
  }
};
