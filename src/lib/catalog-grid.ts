export const CATALOG_POSTER_GRID_CLASS =
  "grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5";

export const catalogGridColumnCount = (viewportWidth: number) => {
  if (viewportWidth >= 1024) {
    return 5;
  }
  if (viewportWidth >= 640) {
    return 3;
  }
  return 2;
};
