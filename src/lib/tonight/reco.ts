import { clamp01, cosine, itemVector } from "@/lib/tonight/features";
import type { TasteProfile } from "@/lib/tonight/profile";
import {
  formatStarsCompact,
  joinEs,
  meanImdb,
  scoreCandidate,
  sharedFeatureNames,
  WEIGHTS,
} from "@/lib/tonight/score";
import type {
  RecoCandidate,
  RecoPick,
  RecoSeed,
  TonightEvent,
  TonightReason,
  TonightTitle,
} from "@/lib/tonight/types";

/** How far a cosine of ±0.4 moves gusto from the neutral 0.5 (same scale as the queue). */
const RECO_GUSTO_SCALE = 1.25;
/** Recommendations kept per user: lenses pick 3 each, so this leaves room to be disjoint. */
export const RECO_POOL_SIZE = 36;

/** A candidate plus what the engine needs to read it as a title. */
export type RecoInput = { candidate: RecoCandidate; title: TonightTitle };

/**
 * The seed that explains a recommendation best: a film you rated high or keep in Favoritas,
 * then one you saved in Quiero ver. A lukewarm 3.5★ watch can lead us to a film but is not a
 * reason worth showing, so it never explains one.
 */
export const bestSeed = (candidate: RecoCandidate): RecoSeed | null => {
  let best: { seed: RecoSeed; strength: number } | null = null;
  for (const source of candidate.sources) {
    const seed = source.seed;
    if (!seed) {
      continue;
    }
    // Watched with no rating can only have got here through Favoritas.
    const loved = seed.via === "watched" && (seed.rating == null || seed.rating >= 8);
    const strength = loved ? 3 : seed.via === "queue" ? 2 : 0;
    if (strength > 0 && (!best || strength > best.strength)) {
      best = { seed, strength };
    }
  }
  return best?.seed ?? null;
};

const seedReason = (
  seed: RecoSeed,
  title: TonightTitle,
  gusto: number,
  titlesById: ReadonlyMap<string, TonightTitle>,
): TonightReason => {
  const text =
    seed.via === "queue"
      ? `Porque tienes ${seed.name} en Quiero ver`
      : seed.rating != null
        ? `Porque le diste ${formatStarsCompact(seed.rating)} a ${seed.name}`
        : `Porque ${seed.name} está en tus Favoritas`;
  const other = titlesById.get(seed.titleId);
  const shared = other ? sharedFeatureNames(title, other) : [];
  return {
    kind: "reco_seed",
    text,
    detail: shared.length > 0 ? `Comparten ${joinEs(shared)}` : undefined,
    // Above the generic «taste anchor» (0.3 × gusto + ≤0.1) so the seed leads the headline.
    weight: WEIGHTS.gusto * gusto + 0.15,
    personal: true,
  };
};

const genreReason = (
  title: TonightTitle,
  gusto: number,
  genreAffinity: ReadonlyMap<number, number>,
): TonightReason | null => {
  const genre = [...title.genres]
    .sort((a, b) => (genreAffinity.get(b.id) ?? 0) - (genreAffinity.get(a.id) ?? 0))
    .find((item) => (genreAffinity.get(item.id) ?? 0) > 0);
  if (!genre) {
    return null;
  }
  return {
    kind: "reco_genre",
    text: `Va con lo que sueles guardar: ${genre.name}`,
    weight: WEIGHTS.gusto * gusto + 0.05,
    personal: true,
  };
};

/**
 * Rank candidates for one user: the same score as the queue (taste, quality, freshness,
 * fatigue), with no queue signals (impulse, aging) because they are not saved. `profile` is
 * the one with Quiero ver folded in; `titlesById` holds the library, to name shared traits.
 */
export const scoreRecos = (input: {
  inputs: readonly RecoInput[];
  profile: TasteProfile;
  titlesById: ReadonlyMap<string, TonightTitle>;
  events: readonly TonightEvent[];
  now: Date;
}): RecoPick[] => {
  const { profile, titlesById, now } = input;
  const eventsByTitle = new Map<string, TonightEvent[]>();
  for (const event of input.events) {
    const bucket = eventsByTitle.get(event.titleId);
    if (bucket) {
      bucket.push(event);
    } else {
      eventsByTitle.set(event.titleId, [event]);
    }
  }
  const qualityPrior = meanImdb(input.inputs.map((entry) => entry.title));

  const picks = input.inputs.map(({ candidate, title }): RecoPick => {
    const vector = itemVector(title);
    const gusto =
      profile.vector.size === 0 ? 0.5 : clamp01(0.5 + cosine(profile.vector, vector) * RECO_GUSTO_SCALE);
    const base = scoreCandidate(title, vector, gusto, {
      profile,
      titlesById,
      queueById: new Map(),
      eventsByTitle,
      qualityPrior,
      now,
    });

    const seed = bestSeed(candidate);
    const reasons: TonightReason[] = [...base.reasons];
    if (seed) {
      // The seed already says it; «Porque le diste 5★ a X» twice would just repeat.
      const withoutSeedAnchor = reasons.filter(
        (reason) => !(reason.kind === "taste_anchor" && reason.text.includes(seed.name)),
      );
      reasons.length = 0;
      reasons.push(...withoutSeedAnchor, seedReason(seed, title, gusto, titlesById));
    } else {
      const reason = genreReason(title, gusto, profile.genreAffinity);
      if (reason) {
        reasons.push(reason);
      }
    }
    reasons.sort((a, b) => b.weight - a.weight);

    return {
      ...base,
      titleId: candidate.catalogId,
      reasons,
      catalogId: candidate.catalogId,
      sourceKind: candidate.sources.some((source) => source.seed) ? "recommendations" : "discover",
      seed,
      candidate,
      genres: title.genres,
    };
  });

  return picks.sort((a, b) => b.baseScore - a.baseScore);
};
