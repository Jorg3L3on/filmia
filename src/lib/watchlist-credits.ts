import type { TitleKind } from "@/db";
import type { TonightPerson } from "@/lib/tonight/types";

/** TMDB sends some names in their native script (Kurosawa's cast in kana, Kossakovsky in Cyrillic). */
export const isLatinName = (name: string) => /^[\p{Script=Latin}\p{M}\s.'’\-]+$/u.test(name.trim());

const joinNames = (names: readonly string[]) => {
  if (names.length <= 1) {
    return names.join("");
  }
  return `${names.slice(0, -1).join(", ")} y ${names.at(-1)}`;
};

export const CREDITS_CAST_LIMIT = 3;

/**
 * «Dirigida por Ridley Scott · Con Harrison Ford, Rutger Hauer y Sean Young».
 * Non-Latin names are dropped rather than shown raw; null when nothing is left.
 */
export const formatCredits = (people: readonly TonightPerson[], kind: TitleKind): string | null => {
  const lead = people.find(
    (person) => (person.role === "director" || person.role === "creator") && isLatinName(person.name),
  );
  const cast = people
    .filter((person) => person.role === "cast" && isLatinName(person.name))
    .slice(0, CREDITS_CAST_LIMIT)
    .map((person) => person.name);

  const parts: string[] = [];
  if (lead) {
    const verb = kind === "SERIES" && lead.role === "creator" ? "Creada" : "Dirigida";
    parts.push(`${verb} por ${lead.name}`);
  }
  if (cast.length > 0) {
    parts.push(`Con ${joinNames(cast)}`);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
};
