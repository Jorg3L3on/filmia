import { slugify } from "@/lib/labels";
import { parseTmdbGenres, type TmdbGenre } from "@/lib/tmdb";

export const DIARY_PICKS_LIMIT = 5;
export const DIARY_CATEGORY_LIMIT = 4;
export const DIARY_CATEGORY_PARAM = "categoria";
export const DIARY_MODE_PARAM = "mode";

export type DiaryMode = "picks" | "historial";

export const parseDiaryMode = (value: unknown): DiaryMode => {
  const raw = Array.isArray(value) ? value.at(-1) : value;
  return raw === "historial" ? "historial" : "picks";
};

export const diaryModeHref = (mode: DiaryMode) =>
  mode === "historial" ? `/?${DIARY_MODE_PARAM}=historial` : "/";

export type DiaryPickTitle = {
  id: string;
  imdbRating: number | null;
  tmdbGenres: unknown;
};

export type DiaryCategory = {
  id: number;
  name: string;
  slug: string;
  count: number;
  averageImdb: number;
};

export const parseStoredTmdbGenres = (value: unknown): TmdbGenre[] =>
  parseTmdbGenres(value);

export const genreSlug = (name: string, id: number) => {
  const slug = slugify(name);
  return slug || `genero-${id}`;
};

export const diaryHref = (slug?: string | null) => {
  if (!slug) {
    return "/";
  }

  return `/?${DIARY_CATEGORY_PARAM}=${encodeURIComponent(slug)}`;
};

export const parseCategorySlug = (value: unknown): string | null => {
  if (typeof value === "string") {
    const slug = value.trim();
    return slug || null;
  }

  if (Array.isArray(value)) {
    for (let index = value.length - 1; index >= 0; index -= 1) {
      const item = value[index];
      if (typeof item === "string" && item.trim()) {
        return item.trim();
      }
    }
  }

  return null;
};

const averageImdb = (ratings: Array<number | null>) => {
  const scored = ratings.filter((rating): rating is number => rating != null);
  if (scored.length === 0) {
    return 0;
  }

  return scored.reduce((sum, rating) => sum + rating, 0) / scored.length;
};

export const pickDiaryCategories = (
  titles: readonly DiaryPickTitle[],
  limit = DIARY_CATEGORY_LIMIT,
): DiaryCategory[] => {
  const buckets = new Map<
    number,
    { genre: TmdbGenre; ratings: Array<number | null> }
  >();

  for (const title of titles) {
    const genres = parseStoredTmdbGenres(title.tmdbGenres);
    for (const genre of genres) {
      const bucket = buckets.get(genre.id);
      if (bucket) {
        bucket.ratings.push(title.imdbRating);
        continue;
      }

      buckets.set(genre.id, { genre, ratings: [title.imdbRating] });
    }
  }

  return [...buckets.values()]
    .map(({ genre, ratings }) => ({
      id: genre.id,
      name: genre.name,
      slug: genreSlug(genre.name, genre.id),
      count: ratings.length,
      averageImdb: averageImdb(ratings),
    }))
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }

      if (right.averageImdb !== left.averageImdb) {
        return right.averageImdb - left.averageImdb;
      }

      return left.name.localeCompare(right.name, "es");
    })
    .slice(0, limit);
};

export const resolveDiaryCategory = (
  categories: readonly DiaryCategory[],
  slug: string | null,
): DiaryCategory | null => {
  if (categories.length === 0) {
    return null;
  }

  const match = slug
    ? categories.find((category) => category.slug === slug)
    : undefined;
  return match ?? categories[0] ?? null;
};

export const titlesForDiaryCategory = <T extends DiaryPickTitle>(
  titles: readonly T[],
  genreId: number,
  limit = DIARY_PICKS_LIMIT,
): T[] => {
  return titles
    .filter((title) =>
      parseStoredTmdbGenres(title.tmdbGenres).some((genre) => genre.id === genreId),
    )
    .toSorted((left, right) => {
      const leftRating = left.imdbRating;
      const rightRating = right.imdbRating;
      if (leftRating == null && rightRating == null) {
        return 0;
      }

      if (leftRating == null) {
        return 1;
      }

      if (rightRating == null) {
        return -1;
      }

      if (rightRating !== leftRating) {
        return rightRating - leftRating;
      }

      return 0;
    })
    .slice(0, limit);
};
