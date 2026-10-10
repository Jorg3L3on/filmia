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
 * K-fold hold-out over the user's well-rated watches (≥8): round-robin over
 * recency so every fold mixes recent and old, each fold hides 2–8 titles as the
 * ground truth «this user liked it» and every liked title is hidden exactly once.
 * Empty when the user is too thin to test.
 */
export const splitFolds = <T extends HoldoutCandidate>(
  titles: readonly T[],
  folds = 3,
): HoldoutSplit<T>[] => {
  const rated = titles.filter((title) => title.watchedAt != null && title.rating != null);
  if (rated.length < EVAL_MIN_RATED) {
    return [];
  }
  const liked = rated
    .filter((title) => (title.rating ?? 0) >= HOLDOUT_MIN_RATING)
    .sort((a, b) => (b.watchedAt?.getTime() ?? 0) - (a.watchedAt?.getTime() ?? 0));
  const count = Math.min(folds, Math.floor(liked.length / HOLDOUT_MIN));
  if (count < 1 || liked.length < HOLDOUT_MIN + 1) {
    return [];
  }
  return Array.from({ length: count }, (_, fold) => {
    const holdout = liked.filter((_, index) => index % count === fold).slice(0, HOLDOUT_MAX);
    const hidden = new Set(holdout.map((title) => title.id));
    return { holdout, train: titles.filter((title) => !hidden.has(title.id)) };
  });
};

export const evalKey = (kind: TitleKind, tmdbId: number) => `${kind}:${tmdbId}`;

/** How many hidden titles sit among the first `k` ranked keys. */
export const hitsAtK = (ranked: readonly string[], hidden: ReadonlySet<string>, k: number) => {
  let hits = 0;
  for (const key of ranked.slice(0, k)) {
    if (hidden.has(key)) {
      hits += 1;
    }
  }
  return hits;
};

/** Share of the hidden titles found among the first `k` ranked keys. */
export const recallAtK = (ranked: readonly string[], hidden: ReadonlySet<string>, k: number) =>
  hidden.size === 0 ? 0 : hitsAtK(ranked, hidden, k) / hidden.size;

/** How many hidden titles are present anywhere in the candidate pool. */
export const poolHits = (pool: ReadonlySet<string>, hidden: ReadonlySet<string>) => {
  let hits = 0;
  for (const key of hidden) {
    if (pool.has(key)) {
      hits += 1;
    }
  }
  return hits;
};

/** Share of the hidden titles present anywhere in the candidate pool. */
export const poolRecall = (pool: ReadonlySet<string>, hidden: ReadonlySet<string>) =>
  hidden.size === 0 ? 0 : poolHits(pool, hidden) / hidden.size;

/** Sorted, joined keys: two accounts with the same signature hold the same library. */
export const librarySignature = (keys: readonly string[]) => [...keys].sort().join("|");

export const mean = (values: readonly number[]) =>
  values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;

export const pct = (value: number) => `${(value * 100).toFixed(0)} %`;
