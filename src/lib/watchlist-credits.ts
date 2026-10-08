import type { TitleKind } from "@/db";
import type { TonightPerson, TonightReason } from "@/lib/tonight/types";

/** TMDB sends some names in their native script (Kurosawa's cast in kana, Kossakovsky in Cyrillic). */
export const isLatinName = (name: string) => /^[\p{Script=Latin}\p{M}\s.'’\-]+$/u.test(name.trim());

const joinNames = (names: readonly string[]) => {
  if (names.length <= 1) {
    return names.join("");
  }
  return `${names.slice(0, -1).join(", ")} y ${names.at(-1)}`;
};

export const CREDITS_CAST_LIMIT = 3;

/** Most leads named in one credits line (co-directors, a series' creators). */
export const CREDITS_LEAD_LIMIT = 3;

export type CreditParts = {
  /** «Dirigida» or «Creada» (a series credited to its creators). */
  verb: "Dirigida" | "Creada";
  /** Directors (or a series' creators) with their TMDB ids: each links to its filmography. */
  leads: Array<{ id: number; name: string }>;
  cast: string[];
};

/**
 * The pieces of «Dirigida por Ridley Scott · Con Harrison Ford, Rutger Hauer y
 * Sean Young». A series with creators credits them; otherwise the directors.
 * Non-Latin names are dropped rather than shown raw; null when nothing is left.
 */
export const creditParts = (people: readonly TonightPerson[], kind: TitleKind): CreditParts | null => {
  const latin = people.filter((person) => isLatinName(person.name));
  const creators = kind === "SERIES" ? latin.filter((person) => person.role === "creator") : [];
  const directors = latin.filter((person) => person.role === "director");
  const leadPeople = creators.length > 0 ? creators : directors;
  const seen = new Set<number>();
  const leads = leadPeople
    .filter((person) => (seen.has(person.id) ? false : (seen.add(person.id), true)))
    .slice(0, CREDITS_LEAD_LIMIT)
    .map(({ id, name }) => ({ id, name }));
  const cast = latin
    .filter((person) => person.role === "cast")
    .slice(0, CREDITS_CAST_LIMIT)
    .map((person) => person.name);

  if (leads.length === 0 && cast.length === 0) {
    return null;
  }
  return { verb: creators.length > 0 ? "Creada" : "Dirigida", leads, cast };
};

/** «Dirigida por Ridley Scott · Con Harrison Ford, Rutger Hauer y Sean Young», or null. */
export const formatCredits = (people: readonly TonightPerson[], kind: TitleKind): string | null => {
  const parts = creditParts(people, kind);
  if (!parts) {
    return null;
  }
  const pieces: string[] = [];
  if (parts.leads.length > 0) {
    pieces.push(`${parts.verb} por ${joinNames(parts.leads.map((lead) => lead.name))}`);
  }
  if (parts.cast.length > 0) {
    pieces.push(`Con ${joinNames(parts.cast)}`);
  }
  return pieces.join(" · ");
};

/**
 * Hoy's «Dirigida por X» pill: the person behind a `taste_person` reason, from
 * the id the ranker stored on it — never parsed from the text. Picks cached
 * before reasons carried ids fall back to the card's only lead; else null.
 */
export const reasonPerson = (
  reason: Pick<TonightReason, "kind" | "personId"> | null | undefined,
  leads: readonly TonightPerson[],
): TonightPerson | null => {
  if (reason?.kind !== "taste_person") {
    return null;
  }
  if (reason.personId != null) {
    return leads.find((lead) => lead.id === reason.personId) ?? null;
  }
  return leads.length === 1 ? leads[0]! : null;
};
