import { FAVORITAS_SLUG } from "@/lib/lists";
import { cosine, itemVector, type FeatureVector } from "@/lib/tonight/features";
import {
  buildTasteProfile,
  closestAnchor,
  watchWeight,
  type TasteProfile,
  type TasteProfileOptions,
} from "@/lib/tonight/profile";
import { bayesianQuality, meanImdb } from "@/lib/tonight/score";
import type { TonightEvent, TonightTitle } from "@/lib/tonight/types";

/**
 * FIL-I9 · «% para ti»: how likely you are to like a film you have not seen, from the
 * Esta noche taste profile. «Me gustó» = rated ≥ 7 (3.5★) or in Favoritas.
 */

export const LIKED_MIN_RATING = 7;
/** Under this many rated watches the profile is too thin: nothing is shown. */
export const AFFINITY_MIN_RATED = 8;

export const isLiked = (title: Pick<TonightTitle, "rating" | "listSlugs">) =>
  (title.rating != null && title.rating >= LIKED_MIN_RATING) ||
  title.listSlugs.includes(FAVORITAS_SLUG);

/** Everything a prediction needs about the user, built once per request. */
export type AffinityContext = {
  profile: TasteProfile;
  /** Smoothed share of the user's rated watches they liked (the prior). */
  likedRate: number;
  likedCount: number;
  /** IMDb mean of the library: the Bayesian prior for quality. */
  qualityPrior: number;
  /** Largest |genre affinity| in the profile (normalizes the genre feature). */
  genreScale: number;
};

/** The model's inputs, one number each. Order matters: it is the weights' order. */
export type AffinityFeatures = {
  /** Cosine between the profile and the film. */
  taste: number;
  /** Cosine to the closest film you loved (≥8 or Favoritas). */
  anchor: number;
  /** How you rate this director / creator against your mean, in stars (0 = unknown). */
  person: number;
  /** Mean affinity of the film's genres, −1…1. */
  genre: number;
  /** Bayesian IMDb minus the library's mean (0 when unknown). */
  quality: number;
  /** Log-odds of the user's own liked rate. */
  base: number;
};

export const FEATURE_ORDER = ["taste", "anchor", "person", "genre", "quality", "base"] as const;

export const featureArray = (features: AffinityFeatures) =>
  FEATURE_ORDER.map((name) => features[name]);

const logOdds = (p: number) => Math.log(p / (1 - p));

export const buildAffinityContext = (
  titles: readonly TonightTitle[],
  events: readonly TonightEvent[],
  now: Date,
  options: TasteProfileOptions,
): AffinityContext => {
  const profile = buildTasteProfile(titles, events, now, options);
  const rated = titles.filter((title) => title.watchedAt != null && title.rating != null);
  const likedCount = rated.filter(isLiked).length;
  let genreScale = 0;
  for (const value of profile.genreAffinity.values()) {
    genreScale = Math.max(genreScale, Math.abs(value));
  }
  return {
    profile,
    // Beta(1,1): a user with 8/8 liked is «likely», not «certain».
    likedRate: (likedCount + 1) / (rated.length + 2),
    likedCount,
    qualityPrior: meanImdb(titles.filter((title) => title.watchedAt != null)),
    genreScale,
  };
};

export const affinityFeatures = (
  ctx: AffinityContext,
  title: TonightTitle,
  vector: FeatureVector = itemVector(title),
): AffinityFeatures => {
  const { profile } = ctx;

  const anchor = closestAnchor(profile, vector);

  let personSum = 0;
  let personCount = 0;
  for (const person of title.people) {
    if (person.role === "cast") {
      continue;
    }
    const known = profile.people.get(person.id);
    if (known?.avgRating != null) {
      // One film by them says less than three.
      personSum += ((known.avgRating - profile.mean) / 2) * (Math.min(known.count, 3) / 3);
      personCount += 1;
    }
  }

  let genreSum = 0;
  for (const genre of title.genres) {
    genreSum += profile.genreAffinity.get(genre.id) ?? 0;
  }
  const genre =
    title.genres.length === 0 || ctx.genreScale === 0
      ? 0
      : genreSum / title.genres.length / ctx.genreScale;

  const weighted = bayesianQuality(title.imdbRating, title.imdbVotes, ctx.qualityPrior);

  return {
    taste: profile.vector.size === 0 ? 0 : cosine(profile.vector, vector),
    anchor: anchor?.similarity ?? 0,
    person: personCount === 0 ? 0 : personSum / personCount,
    genre,
    quality: weighted == null ? 0 : weighted - ctx.qualityPrior,
    base: logOdds(ctx.likedRate),
  };
};

const dot = (a: FeatureVector, b: FeatureVector) => {
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  let sum = 0;
  for (const [key, value] of small) {
    const other = large.get(key);
    if (other) {
      sum += value * other;
    }
  }
  return sum;
};

const squaredNorm = (vector: FeatureVector) => {
  let sum = 0;
  for (const value of vector.values()) {
    sum += value * value;
  }
  return sum;
};

/**
 * Taste (cosine) of each film you liked against your profile WITHOUT that film: how close
 * a film you liked looks to the rest of your taste. Exact for the vector (the film's own
 * weighted contribution is subtracted), O(features) per film. The yardstick for the levels.
 */
export const likedTasteLeaveOneOut = (
  ctx: AffinityContext,
  titles: readonly TonightTitle[],
  now: Date,
  options: TasteProfileOptions,
): number[] => {
  const profileVector = ctx.profile.vector;
  const profileSq = squaredNorm(profileVector);
  const halfLife = options.halfLifeMonths === undefined ? 18 : options.halfLifeMonths;
  const values: number[] = [];
  for (const title of titles) {
    if (title.watchedAt == null || !isLiked(title)) {
      continue;
    }
    const vector = itemVector(title);
    const weight = watchWeight(title, ctx.profile.mean, now, halfLife, options.collectionBonus ?? 0);
    const vSq = squaredNorm(vector);
    const pv = dot(profileVector, vector);
    const looDot = pv - weight * vSq;
    const looSq = Math.max(0, profileSq - 2 * weight * pv + weight * weight * vSq);
    values.push(looSq === 0 || vSq === 0 ? 0 : looDot / Math.sqrt(looSq * vSq));
  }
  return values;
};

/** Linear-interpolated quantile of an unsorted list (`q` in 0…1). */
export const quantile = (values: readonly number[], q: number) => {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * q;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
};

/** What the engine needs about a film the user does not have (a Catalog row, parsed). */
export type AffinityFilm = Pick<
  TonightTitle,
  | "id"
  | "name"
  | "kind"
  | "year"
  | "imdbRating"
  | "imdbVotes"
  | "genres"
  | "keywords"
  | "people"
  | "originalLanguage"
>;

/** A film outside the library as the engine's title shape: unwatched, unrated, in no list. */
export const filmAsTitle = (film: AffinityFilm): TonightTitle => ({
  ...film,
  runtimeMinutes: null,
  platform: null,
  flatrate: [],
  availableOnMine: false,
  watchedAt: null,
  rating: null,
  review: null,
  seriesStatus: null,
  seriesSeason: null,
  listSlugs: [],
  availableSince: null,
  createdAt: new Date(0),
});
