/**
 * La tanda (FIL-I50-3): ten films a week per person, answered with four stamps. Pure: the week's
 * epoch, the 6 / 2 / 2 mix, what an answer writes and how events encode it.
 */

export const TANDA_SIZE = 10;
/** «Las que todos vimos», «afines a lo tuyo», «comodines». */
export const TANDA_MIX = { popular: 6, afin: 2, comodin: 2 } as const;
/** Positions of the afines (a) and comodines (c) in the deck, so they never bunch up at the end. */
const SLOT_ORDER = ["p", "p", "a", "p", "c", "p", "a", "p", "c", "p"] as const;
export type TandaSlot = "p" | "a" | "c";

/** Seen by enough people that «¿la viste?» makes sense. */
export const TANDA_MIN_VOTES = 1500;

export type Epoch = { from: number; to: number };

/** The epoch rotates with the week; the comodines come from the epoch half a turn away. */
export const TANDA_EPOCHS: readonly Epoch[] = [
  { from: 2001, to: 2015 },
  { from: 1985, to: 1999 },
  { from: 2010, to: 2019 },
  { from: 1995, to: 2005 },
  { from: 2014, to: 2024 },
  { from: 1975, to: 1994 },
];

export const epochLabel = (epoch: Epoch) => `${epoch.from}–${epoch.to}`;

/** Weeks since 2026-01-05 (a Monday): the rotation index of a `YYYY-MM-DD` Monday. */
export const weekIndex = (weekKey: string) =>
  Math.floor((Date.parse(`${weekKey}T00:00:00Z`) - Date.UTC(2026, 0, 5)) / (7 * 86_400_000));

const mod = (value: number, size: number) => ((value % size) + size) % size;

/** The epochs of a round: the week's first, then one step further for every «Otra tanda». */
export const epochsOfWeek = (weekKey: string, round = 1) => {
  const index = weekIndex(weekKey) + Math.max(0, round - 1);
  return {
    main: TANDA_EPOCHS[mod(index, TANDA_EPOCHS.length)]!,
    wild: TANDA_EPOCHS[mod(index + Math.floor(TANDA_EPOCHS.length / 2), TANDA_EPOCHS.length)]!,
  };
};

export type TandaCandidate = { tmdbId: number; voteCount: number; genreIds?: readonly number[] };

/**
 * The ten: 6 popular of the epoch (most voted first), 2 afines to the person's seeds and 2
 * comodines from another epoch and, when possible, a genre the person has not touched. Without
 * seeds (or afines left) the gaps take more popular ones. Never a film in `exclude`, never twice.
 */
export const pickTanda = <T extends TandaCandidate>(input: {
  popular: readonly T[];
  afines: readonly T[];
  comodines: readonly T[];
  exclude: ReadonlySet<number>;
  /** Genres the person already watches: comodines prefer others. */
  knownGenres?: ReadonlySet<number>;
}): Array<T & { slot: TandaSlot }> => {
  const taken = new Set(input.exclude);
  const byVotes = (list: readonly T[]) => [...list].sort((a, b) => b.voteCount - a.voteCount);
  const take = (list: readonly T[], count: number) => {
    const out: T[] = [];
    for (const item of list) {
      if (out.length >= count) break;
      if (taken.has(item.tmdbId)) continue;
      taken.add(item.tmdbId);
      out.push(item);
    }
    return out;
  };
  const known = input.knownGenres ?? new Set<number>();
  const fresh = (item: T) => !(item.genreIds ?? []).some((genre) => known.has(genre));
  const comodinPool = [...byVotes(input.comodines).filter(fresh), ...byVotes(input.comodines).filter((item) => !fresh(item))];

  // Afines and comodines first (they are scarcer), then popular fills everything else.
  const afines = take(byVotes(input.afines), TANDA_MIX.afin);
  const comodines = take(comodinPool, TANDA_MIX.comodin);
  const popularNeeded = TANDA_SIZE - afines.length - comodines.length;
  const popular = take(byVotes(input.popular), popularNeeded);

  const queues: Record<TandaSlot, T[]> = { p: [...popular], a: [...afines], c: [...comodines] };
  const out: Array<T & { slot: TandaSlot }> = [];
  for (const wanted of SLOT_ORDER) {
    // A missing afín or comodín gives its place to the next popular one (and the other way round).
    const order: TandaSlot[] = [wanted, "p", "a", "c"];
    const slot = order.find((candidate) => queues[candidate].length > 0);
    if (slot) {
      out.push({ ...queues[slot].shift()!, slot });
    }
  }
  return out;
};

// ---------------------------------------------------------------------------
// Answers
// ---------------------------------------------------------------------------

/** Right · left · down · up on the card; «quiero» is «no la vi» + Quiero ver. */
export const TANDA_ANSWERS = ["liked", "no", "meh", "loved", "want"] as const;
export type TandaAnswer = (typeof TANDA_ANSWERS)[number];

export const isTandaAnswer = (value: unknown): value is TandaAnswer => TANDA_ANSWERS.includes(value as TandaAnswer);

/** A seen answer: it writes a watched title, undated (FIL-I50-1). */
export const isSeenAnswer = (answer: TandaAnswer) => answer === "liked" || answer === "meh" || answer === "loved";

/**
 * `Title.impliedRating` per seen answer. The engine centres implied ratings on 7 and clamps the
 * weight at ±1.5 (`tonight/profile.ts`): 10 is the strongest «me encantó» it reads, and an anchor.
 */
export const TANDA_RATING: Record<"liked" | "meh" | "loved", number> = { liked: 8, meh: 4, loved: 10 };

export const TANDA_ANSWER_LABEL: Record<TandaAnswer, string> = {
  liked: "Me gustó",
  no: "No la vi",
  meh: "No tanto",
  loved: "Me encantó",
  want: "Quiero verla",
};

export const TANDA_DEALT_KIND = "tanda_dealt";
export const TANDA_ANSWERED_KIND = "tanda_answered";

/**
 * `tanda_dealt` lens: `<week>|<slot>` for the week's first round, `<week>|<slot>|<round>` for each
 * «Otra tanda» after it (FIL-I50-7). An answer belongs to the round its card was dealt in.
 */
export const dealtLens = (weekKey: string, slot: TandaSlot, round = 1) =>
  round <= 1 ? `${weekKey}|${slot}` : `${weekKey}|${slot}|${round}`;
/** `tanda_answered` lens: `<week>|<answer>|<new|old>`, «new» when the answer created the title. */
export const answeredLens = (weekKey: string, answer: TandaAnswer, createdTitle: boolean) =>
  `${weekKey}|${answer}|${createdTitle ? "new" : "old"}`;

export const parseTandaLens = (lens: string | null) => {
  const [week, second, third] = (lens ?? "").split("|");
  const slot = (second === "p" || second === "a" || second === "c" ? second : null) as TandaSlot | null;
  const round = slot && third && /^\d+$/.test(third) ? Number(third) : 1;
  return {
    week: week ?? "",
    slot,
    round,
    answer: isTandaAnswer(second) ? second : null,
    createdTitle: third === "new",
  };
};

/** Corte's headline: «Viste 6 de 10», «Ninguna esta vez». */
export const corteHeadline = (seen: number, total = TANDA_SIZE) =>
  seen === 0 ? "Ninguna esta vez" : `Viste ${seen} de ${total}`;
