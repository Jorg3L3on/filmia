import type { TonightPerson } from "@/lib/tonight/types";

export type FavoriteDirector = {
  id: number;
  name: string;
  /** How many of your loved titles they directed. */
  count: number;
};

export type FavoriteDirectorSource = {
  /** 1–10 (half stars). */
  rating: number | null;
  /** In the Favoritas list. */
  favorite: boolean;
  people: readonly TonightPerson[];
};

/** 4★ and up counts as loved. */
export const LOVED_RATING = 8;

const weightOf = (source: FavoriteDirectorSource) =>
  (source.favorite ? 2 : 0) + (source.rating !== null && source.rating >= LOVED_RATING ? source.rating / 10 : 0);

/**
 * Buscar's «Directores de tus favoritas»: directors of titles in Favoritas or rated 4★+,
 * ranked by how much you loved their work (Favoritas weigh most), then by name.
 */
export const rankFavoriteDirectors = (
  sources: readonly FavoriteDirectorSource[],
  limit = 6,
): FavoriteDirector[] => {
  const byId = new Map<number, FavoriteDirector & { weight: number }>();
  for (const source of sources) {
    const weight = weightOf(source);
    if (weight <= 0) {
      continue;
    }
    const seen = new Set<number>();
    for (const person of source.people) {
      if (person.role !== "director" || seen.has(person.id)) {
        continue;
      }
      seen.add(person.id);
      const current = byId.get(person.id);
      if (current) {
        current.weight += weight;
        current.count += 1;
      } else {
        byId.set(person.id, { id: person.id, name: person.name, count: 1, weight });
      }
    }
  }
  return [...byId.values()]
    .sort((a, b) => b.weight - a.weight || a.name.localeCompare(b.name, "es"))
    .slice(0, limit)
    .map(({ id, name, count }) => ({ id, name, count }));
};
