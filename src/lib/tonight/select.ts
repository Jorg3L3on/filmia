import { genreSlug } from "@/lib/diary-picks";
import type { FeatureVector } from "@/lib/tonight/features";
import type { TasteProfile } from "@/lib/tonight/profile";
import { candidateSimilarity } from "@/lib/tonight/score";
import type { TonightLens, TonightPickBase, TonightTitle } from "@/lib/tonight/types";

export const PARA_TI_SLUG = "para-ti";
export const PARA_TI_NAME = "Para ti";
export const LENS_SIZE = 5;
export const GENRE_LENS_LIMIT = 3;
export const MMR_LAMBDA = 0.65;
export const MAX_PER_GENRE = 2;

export type ScoredCandidate = {
  title: TonightTitle;
  vector: FeatureVector;
  pick: TonightPickBase;
};

const primaryGenre = (title: TonightTitle) => title.genres[0]?.id ?? null;

/**
 * Maximal Marginal Relevance: each new card must be relevant AND unlike the
 * ones already chosen (λ 0.65), with at most two per primary genre.
 */
export const mmrSelect = (
  candidates: readonly ScoredCandidate[],
  k = LENS_SIZE,
  lambda = MMR_LAMBDA,
  maxPerGenre = MAX_PER_GENRE,
): ScoredCandidate[] => {
  const chosen: ScoredCandidate[] = [];
  const pool = [...candidates];
  const genreCounts = new Map<number, number>();

  while (chosen.length < k && pool.length > 0) {
    let bestIndex = -1;
    let bestValue = Number.NEGATIVE_INFINITY;

    for (let index = 0; index < pool.length; index += 1) {
      const candidate = pool[index];
      if (!candidate) {
        continue;
      }
      const genre = primaryGenre(candidate.title);
      if (genre != null && (genreCounts.get(genre) ?? 0) >= maxPerGenre && pool.length > k - chosen.length) {
        continue;
      }
      let maxSimilarity = 0;
      for (const picked of chosen) {
        maxSimilarity = Math.max(
          maxSimilarity,
          candidateSimilarity(candidate.vector, picked.vector),
        );
      }
      const value = lambda * candidate.pick.baseScore - (1 - lambda) * maxSimilarity;
      if (value > bestValue) {
        bestValue = value;
        bestIndex = index;
      }
    }

    if (bestIndex < 0) {
      // Every remaining card is blocked by the per-genre cap: relax it.
      bestIndex = 0;
    }

    const [picked] = pool.splice(bestIndex, 1);
    if (!picked) {
      break;
    }
    const genre = primaryGenre(picked.title);
    if (genre != null) {
      genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 1);
    }
    chosen.push(picked);
  }

  return chosen;
};

const median = (values: number[]) => {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
    : (sorted[middle] ?? 0);
};

/** One card out of your zone: strong quality or long wait, little known affinity. */
export const pickWildcard = (
  candidates: readonly ScoredCandidate[],
  exclude: ReadonlySet<string>,
): ScoredCandidate | null => {
  const pool = candidates.filter((candidate) => !exclude.has(candidate.title.id));
  if (pool.length === 0) {
    return null;
  }
  const gustoMedian = median(pool.map((candidate) => candidate.pick.components.gusto));
  const outside = pool.filter((candidate) => candidate.pick.components.gusto < gustoMedian);
  if (outside.length === 0) {
    return null;
  }
  let best: ScoredCandidate | null = null;
  let bestValue = Number.NEGATIVE_INFINITY;
  for (const candidate of outside) {
    const value =
      0.6 * candidate.pick.components.calidad + 0.4 * candidate.pick.components.reposo;
    if (value > bestValue) {
      bestValue = value;
      best = candidate;
    }
  }
  if (!best) {
    return null;
  }
  return {
    ...best,
    pick: {
      ...best.pick,
      wildcard: true,
      reasons: [
        {
          kind: "wildcard",
          text: "Comodín · fuera de lo que sueles ver",
          weight: 1,
          personal: true,
        },
        ...best.pick.reasons,
      ],
    },
  };
};

const byScoreDesc = (a: ScoredCandidate, b: ScoredCandidate) =>
  b.pick.baseScore - a.pick.baseScore;

/** Genres ranked by taste affinity, falling back to how many queued titles carry them. */
export const rankGenres = (
  candidates: readonly ScoredCandidate[],
  profile: TasteProfile,
) => {
  const counts = new Map<number, { id: number; name: string; count: number }>();
  for (const candidate of candidates) {
    for (const genre of candidate.title.genres) {
      const current = counts.get(genre.id) ?? { id: genre.id, name: genre.name, count: 0 };
      current.count += 1;
      counts.set(genre.id, current);
    }
  }
  return [...counts.values()].sort((a, b) => {
    const affinityA = profile.genreAffinity.get(a.id) ?? 0;
    const affinityB = profile.genreAffinity.get(b.id) ?? 0;
    if (affinityB !== affinityA) {
      return affinityB - affinityA;
    }
    if (b.count !== a.count) {
      return b.count - a.count;
    }
    return a.name.localeCompare(b.name, "es");
  });
};

export const buildLenses = (
  candidates: readonly ScoredCandidate[],
  profile: TasteProfile,
): TonightLens[] => {
  if (candidates.length === 0) {
    return [];
  }

  const sorted = [...candidates].sort(byScoreDesc);
  const core = mmrSelect(sorted, LENS_SIZE - 1);
  const used = new Set(core.map((candidate) => candidate.title.id));
  const wildcard = pickWildcard(sorted, used);
  const paraTi = wildcard ? [...core, wildcard] : mmrSelect(sorted, LENS_SIZE);
  for (const candidate of paraTi) {
    used.add(candidate.title.id);
  }

  const lenses: TonightLens[] = [
    {
      slug: PARA_TI_SLUG,
      name: PARA_TI_NAME,
      kind: "para-ti",
      genreId: null,
      picks: paraTi.map((candidate) => candidate.pick),
    },
  ];

  const remaining = sorted.filter((candidate) => !used.has(candidate.title.id));
  for (const genre of rankGenres(remaining, profile)) {
    if (lenses.length > GENRE_LENS_LIMIT) {
      break;
    }
    const picks = remaining
      .filter(
        (candidate) =>
          !used.has(candidate.title.id) &&
          candidate.title.genres.some((item) => item.id === genre.id),
      )
      .slice(0, LENS_SIZE);
    if (picks.length === 0) {
      continue;
    }
    for (const candidate of picks) {
      used.add(candidate.title.id);
    }
    lenses.push({
      slug: genreSlug(genre.name, genre.id),
      name: genre.name,
      kind: "genre",
      genreId: genre.id,
      picks: picks.map((candidate) => candidate.pick),
    });
  }

  return lenses;
};
