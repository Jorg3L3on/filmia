import { isLatinName } from "@/lib/watchlist-credits";

/** A film's director as the Cine tile draws it (FIL-32). */
export type CineDirector = { id: number; name: string; profilePath: string | null };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

/**
 * Directors from `catalog.tmdbPeople`, in TMDB's order and once each. Like the
 * credits line, names TMDB sends in a non-Latin script are dropped. Anything
 * that is not a valid list (null, corrupt jsonb) gives no directors: the tile
 * then looks like it did before.
 */
export const cineDirectorsOf = (tmdbPeople: unknown): CineDirector[] => {
  if (!Array.isArray(tmdbPeople)) {
    return [];
  }
  const seen = new Set<number>();
  const directors: CineDirector[] = [];
  for (const item of tmdbPeople) {
    if (!isRecord(item) || item.role !== "director") {
      continue;
    }
    const id = Number(item.id);
    const name = typeof item.name === "string" ? item.name.trim() : "";
    if (!Number.isInteger(id) || id <= 0 || !name || !isLatinName(name) || seen.has(id)) {
      continue;
    }
    seen.add(id);
    const profilePath = typeof item.profilePath === "string" && item.profilePath.startsWith("/") ? item.profilePath : null;
    directors.push({ id, name, profilePath });
  }
  return directors;
};

/** «Denis Villeneuve» → «D. Villeneuve»; «María Fernanda Ayala» → «M. Fernanda Ayala»; «Kogonada» stays. */
export const shortDirectorName = (name: string): string => {
  const words = name.trim().split(/\s+/u);
  if (words.length < 2) {
    return words[0] ?? "";
  }
  const initial = Array.from(words[0]!)[0]!.toLocaleUpperCase("es-MX");
  return `${initial}. ${words.slice(1).join(" ")}`;
};

const joinNames = (names: readonly string[]) =>
  names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} y ${names.at(-1)}`;

/** The tile's accessible tail: «, dirigida por A y B» / «, dirigida por A, B y 3 más» / "". */
export const directedByLabel = (directors: readonly CineDirector[]): string => {
  if (directors.length === 0) {
    return "";
  }
  const named = directors.slice(0, 2).map((director) => director.name);
  const rest = directors.length - named.length;
  return `, dirigida por ${rest > 0 ? `${named.join(", ")} y ${rest} más` : joinNames(named)}`;
};
