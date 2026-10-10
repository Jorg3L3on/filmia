import type { TitleKind } from "@/db";

/**
 * Offline evaluation of the recommendation pipeline (FIL-I6-1). Pure helpers:
 * the hold-out split and the recall maths. `scripts/eval-tonight.ts` does the I/O.
 */

export const HOLDOUT_MIN_RATING = 8;
export const HOLDOUT_FRACTION = 0.2;
export const HOLDOUT_MIN = 2;
export const HOLDOUT_MAX = 8;
/** A user needs this many rated watched titles to be evaluated at all. */
export const EVAL_MIN_RATED = 8;

export type HoldoutCandidate = {
  id: string;
  watchedAt: Date | null;
  rating: number | null;
};

export type HoldoutSplit<T extends HoldoutCandidate> = {
  holdout: T[];
  train: T[];
};

/**
 * Hide the most recent well-rated watches (≥8, 20 %, between 2 and 8) as the
 * ground truth «this user liked it». `null` when the user is too thin to test.
 */
export const splitHoldout = <T extends HoldoutCandidate>(
  titles: readonly T[],
): HoldoutSplit<T> | null => {
  const rated = titles.filter((title) => title.watchedAt != null && title.rating != null);
  if (rated.length < EVAL_MIN_RATED) {
    return null;
  }
  const liked = rated
    .filter((title) => (title.rating ?? 0) >= HOLDOUT_MIN_RATING)
    .sort((a, b) => (b.watchedAt?.getTime() ?? 0) - (a.watchedAt?.getTime() ?? 0));
  const size = Math.min(
    HOLDOUT_MAX,
    Math.max(HOLDOUT_MIN, Math.ceil(liked.length * HOLDOUT_FRACTION)),
  );
  if (liked.length < size + 1) {
    return null;
  }
  const holdout = liked.slice(0, size);
  const hidden = new Set(holdout.map((title) => title.id));
  return { holdout, train: titles.filter((title) => !hidden.has(title.id)) };
};

export const evalKey = (kind: TitleKind, tmdbId: number) => `${kind}:${tmdbId}`;

/** Share of the hidden titles found among the first `k` ranked keys. */
export const recallAtK = (
  ranked: readonly string[],
  hidden: ReadonlySet<string>,
  k: number,
) => {
  if (hidden.size === 0) {
    return 0;
  }
  let hits = 0;
  for (const key of ranked.slice(0, k)) {
    if (hidden.has(key)) {
      hits += 1;
    }
  }
  return hits / hidden.size;
};

/** Share of the hidden titles present anywhere in the candidate pool. */
export const poolRecall = (pool: ReadonlySet<string>, hidden: ReadonlySet<string>) => {
  if (hidden.size === 0) {
    return 0;
  }
  let hits = 0;
  for (const key of hidden) {
    if (pool.has(key)) {
      hits += 1;
    }
  }
  return hits / hidden.size;
};

export const mean = (values: readonly number[]) =>
  values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;

export const pct = (value: number) => `${(value * 100).toFixed(0)} %`;
