import { parseStoredTmdbGenres } from "@/lib/diary-picks";

type OverviewMapTitle = {
  id: string;
  overview: string | null;
};

export const titleSynopsis = (overview?: string | null) => {
  const text = overview?.trim();
  return text ? text : null;
};

export const COMPACT_GENRE_LIMIT = 2;

export const compactGenreLabel = (
  value: unknown,
  limit = COMPACT_GENRE_LIMIT,
) => {
  const genres = parseStoredTmdbGenres(value);
  if (genres.length === 0 || limit <= 0) {
    return null;
  }

  const names = genres.slice(0, limit).map((genre) => genre.name);
  const label = names.join(" · ");
  return genres.length > limit ? `${label}…` : label;
};

export const titleOverviewMap = (titleRows: readonly OverviewMapTitle[]) => {
  const overviews = new Map<string, string>();
  for (const title of titleRows) {
    const text = titleSynopsis(title.overview);
    if (text) {
      overviews.set(title.id, text);
    }
  }
  return overviews;
};
