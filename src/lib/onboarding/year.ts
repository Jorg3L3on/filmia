/** «Lo mejor del año»: which year to show and how to pick a dozen popular titles from TMDB. */

export const YEAR_GRID_SIZE = 12;
/** Enough items to feel like a grid; below this we try the next (lower) vote threshold. */
export const YEAR_GRID_MIN = 8;
/** Below this many items the year is too young (January): fall back to the previous one. */
export const YEAR_GRID_FALLBACK_MIN = 6;
/** Vote-count thresholds tried in order: popular first, then relax. */
export const VOTE_COUNT_LADDER = [300, 100, 25] as const;

export const resolveOnboardingYear = (now: Date) => now.getFullYear();

type Countable = { tmdbId: number; voteCount: number };

/**
 * Given the discover results per ladder threshold (same order as `VOTE_COUNT_LADDER`), pick the
 * first list with at least `YEAR_GRID_MIN` items; otherwise merge every tier (deduped, most voted
 * first). Always capped at `YEAR_GRID_SIZE`.
 */
export const pickYearGrid = <T extends Countable>(tiers: readonly (readonly T[])[]): T[] => {
  for (const tier of tiers) {
    if (tier.length >= YEAR_GRID_MIN) {
      return tier.slice(0, YEAR_GRID_SIZE);
    }
  }
  const seen = new Set<number>();
  const merged: T[] = [];
  for (const tier of tiers) {
    for (const item of tier) {
      if (!seen.has(item.tmdbId)) {
        seen.add(item.tmdbId);
        merged.push(item);
      }
    }
  }
  merged.sort((a, b) => b.voteCount - a.voteCount);
  return merged.slice(0, YEAR_GRID_SIZE);
};

export const yearGridNeedsFallback = (grid: readonly unknown[]) =>
  grid.length < YEAR_GRID_FALLBACK_MIN;
