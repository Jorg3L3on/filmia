/**
 * Quiniela del Óscar (FIL-I51-2): what the ballot screens draw, pure and client-safe. The server
 * builds it from the ceremony file (`loadOscarBallot`); components never read the file itself.
 */
import {
  nomineeDetail,
  nomineeName,
  type OscarCeremonyFile,
  type OscarCategoryKind,
} from "@/lib/juegos/oscar/ceremony-core";

export type BallotNominee = {
  id: string;
  /** Person, «song» or film, Mexican title when known. */
  name: string;
  /** The film for people and songs, the country for international films. */
  detail: string | null;
  posterPath: string | null;
};

export type BallotCategory = {
  id: string;
  label: string;
  short: string;
  kind: OscarCategoryKind;
  nominees: BallotNominee[];
};

export const toBallotCategories = (file: OscarCeremonyFile): BallotCategory[] =>
  file.categories.map((category) => ({
    id: category.id,
    label: category.label,
    short: category.short,
    kind: category.kind,
    nominees: category.nominees.map((nominee) => ({
      id: nominee.id,
      name: nomineeName(nominee),
      detail: nomineeDetail(nominee),
      posterPath: nominee.film.posterPath ?? null,
    })),
  }));

/** Where the stepper opens: the asked category, else the first without a vote, else the first. */
export const startCategoryIndex = (
  categories: readonly { id: string }[],
  votes: Readonly<Record<string, string>>,
  asked?: string | null,
) => {
  const askedIndex = asked ? categories.findIndex((category) => category.id === asked) : -1;
  if (askedIndex >= 0) {
    return askedIndex;
  }
  const firstOpen = categories.findIndex((category) => !Object.hasOwn(votes, category.id));
  return firstOpen >= 0 ? firstOpen : 0;
};

export const votedCount = (categories: readonly { id: string }[], votes: Readonly<Record<string, string>>) =>
  categories.filter((category) => Object.hasOwn(votes, category.id)).length;

/** The ballot as rows: category, its pick (or null). */
export const ballotRows = (categories: readonly BallotCategory[], votes: Readonly<Record<string, string>>) =>
  categories.map((category) => ({
    category,
    pick: category.nominees.find((nominee) => nominee.id === votes[category.id]) ?? null,
  }));

const CLOSE_FORMAT = new Intl.DateTimeFormat("es-MX", {
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Mexico_City",
});

/** «domingo 10 de marzo, 5:00 p.m.» in Mexico City time. */
export const formatOscarClose = (closesAt: Date) => CLOSE_FORMAT.format(closesAt);
