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
  revalidatePath("/diario");
  revalidatePath("/perfil");
  revalidatePath("/watchlist");
  revalidateTitlePages(titleId);
};

export const revalidateRatingSurfaces = (titleId: string) => {
  revalidatePath("/");
  revalidatePath("/diario");
  revalidatePath("/perfil");
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
  revalidatePath("/diario");
  revalidatePath("/listas");
  revalidatePath("/watchlist");
  revalidatePath("/buscar");
  if (titleId) {
    revalidateTitlePages(titleId);
  }
};

export const revalidateSeriesSurfaces = (titleId: string) => {
  revalidatePath("/");
  revalidatePath("/diario");
  revalidatePath("/listas");
  revalidateTitlePages(titleId);
};

export const revalidateProfileSurfaces = () => {
  revalidatePath("/perfil");
  revalidatePath("/");
  revalidatePath("/watchlist");
  revalidatePath("/listas");
};
