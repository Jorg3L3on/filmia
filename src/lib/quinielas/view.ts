/**
 * Quinielas de premios (FIL-I51-2): what the ballot screens draw, pure and client-safe. The server
 * builds it from the ceremony file (`loadBallot`); components never read the file itself.
 */
import type { QuinielaCategoryKind } from "@/lib/quinielas/awards";
import { nomineeDetail, nomineeName, type QuinielaCeremonyFile } from "@/lib/quinielas/ceremony-core";

export type BallotNominee = {
  id: string;
  /** Person, «song», film or series, Mexican title when known. */
  name: string;
  /** The work for people and songs, the country for international films. */
  detail: string | null;
  posterPath: string | null;
};

export type BallotCategory = {
  id: string;
  label: string;
  short: string;
  kind: QuinielaCategoryKind;
  nominees: BallotNominee[];
};

export const toBallotCategories = (file: QuinielaCeremonyFile): BallotCategory[] =>
  file.categories.map((category) => ({
    id: category.id,
    label: category.label,
    short: category.short,
    kind: category.kind,
    nominees: category.nominees.map((nominee) => ({
      id: nominee.id,
      name: nomineeName(nominee),
      detail: nomineeDetail(nominee),
      posterPath: nominee.work.posterPath ?? null,
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
export const formatClose = (closesAt: Date) => CLOSE_FORMAT.format(closesAt);

// ── La noche (FIL-I51-4) ─────────────────────────────────────────────────

export type NightAnnouncement = {
  category: BallotCategory;
  winner: BallotNominee | null;
  pick: BallotNominee | null;
  hit: boolean;
};

export type NightSummary = {
  hits: number;
  announced: number;
  total: number;
  remaining: number;
  finished: boolean;
  /** Per category in ballot order: «y» hit, «n» miss, «p» pending. */
  marks: ("y" | "n" | "p")[];
  /** Newest first. */
  latest: NightAnnouncement[];
  /** The first category still to be announced, in ballot order, with your vote. */
  next: { category: BallotCategory; pick: BallotNominee | null } | null;
};

/** What the live screen shows from the winners entered so far. */
export const nightSummary = (
  categories: readonly BallotCategory[],
  votes: Readonly<Record<string, string>>,
  winners: Readonly<Record<string, { nomineeId: string; announcedAt: Date }>>,
  latestCount = 2,
): NightSummary => {
  const find = (category: BallotCategory, id: string | undefined) =>
    id ? (category.nominees.find((nominee) => nominee.id === id) ?? null) : null;
  const marks = categories.map((category) => {
    const winner = winners[category.id];
    return !winner ? "p" : votes[category.id] === winner.nomineeId ? "y" : "n";
  });
  const announcedCategories = categories.filter((category) => winners[category.id]);
  const latest = [...announcedCategories]
    .sort((a, b) => winners[b.id]!.announcedAt.getTime() - winners[a.id]!.announcedAt.getTime())
    .slice(0, latestCount)
    .map((category) => ({
      category,
      winner: find(category, winners[category.id]!.nomineeId),
      pick: find(category, votes[category.id]),
      hit: votes[category.id] === winners[category.id]!.nomineeId,
    }));
  const nextCategory = categories.find((category) => !winners[category.id]) ?? null;
  const hits = marks.filter((mark) => mark === "y").length;
  return {
    hits,
    announced: announcedCategories.length,
    total: categories.length,
    remaining: categories.length - announcedCategories.length,
    finished: categories.length > 0 && announcedCategories.length === categories.length,
    marks,
    latest,
    next: nextCategory ? { category: nextCategory, pick: find(nextCategory, votes[nextCategory.id]) } : null,
  };
};
