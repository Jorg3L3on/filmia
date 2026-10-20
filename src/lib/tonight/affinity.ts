import { FAVORITAS_SLUG } from "@/lib/lists";
import { cosine, itemVector, type FeatureVector } from "@/lib/tonight/features";
import {
  buildTasteProfile,
  closestAnchor,
  RECENCY_HALF_LIFE_MONTHS,
  watchWeight,
  type TasteProfile,
  type TasteProfileOptions,
} from "@/lib/tonight/profile";
import {
  bayesianQuality,
  formatVotes,
  joinEs,
  meanImdb,
  QUALITY_REASON_MIN,
  tasteReasons,
} from "@/lib/tonight/score";
import { GUSTO_SCALE } from "@/lib/tonight";
import type { TonightEvent, TonightReason, TonightTitle } from "@/lib/tonight/types";

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
  const halfLife =
    options.halfLifeMonths === undefined ? RECENCY_HALF_LIFE_MONTHS : options.halfLifeMonths;
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

// ── The served answer (FIL-I9-2) ─────────────────────────────────────────────────────

/**
 * Profile settings decided by the study (FIL-I9-1, pinned decision): flat recency
 * («¿me gustaría?» does not forget) and your own collections as mild positive evidence.
 * Hoy keeps its defaults (18 months, no bonus).
 */
export const AFFINITY_PROFILE_OPTIONS: TasteProfileOptions = {
  halfLifeMonths: null,
  collectionBonus: 0.3,
};

/**
 * Levels, not a percentage: with 6 «no me gustó» in the whole database a probability
 * could not beat «always say the base rate» (FIL-I9-1). The level compares the film's
 * taste with the taste of what you liked, measured without each of them.
 */
export type AffinityLevel = "alta" | "media" | "baja";

export const AFFINITY_LABEL: Record<AffinityLevel, string> = {
  alta: "Muy tu estilo",
  media: "Podría gustarte",
  baja: "Fuera de tu zona",
};

/** What the level means, for the «¿Por qué?» sheet. */
export const AFFINITY_MEANING: Record<AffinityLevel, string> = {
  alta: "Se parece a tu gusto tanto como la mitad de lo que te ha gustado.",
  media: "Está entre lo que sueles calificar alto y lo que casi nunca ves.",
  baja: "Se parece a tu gusto menos que casi todo lo que te ha gustado.",
};

/** «Muy tu estilo» from this quantile of your liked films' taste… */
export const LEVEL_HIGH_QUANTILE = 0.5;
/** …«Fuera de tu zona» under this one. */
export const LEVEL_LOW_QUANTILE = 0.1;
/** Rated watches for full confidence; below, the level leans toward «Podría gustarte». */
export const CONFIDENT_RATED = 20;
/** Share of the film's features your profile has seen, for full confidence. */
export const CONFIDENT_COVERAGE = 0.5;
export const LOW_CONFIDENCE = 0.6;
export const AFFINITY_REASON_LIMIT = 3;

export type AffinityScorer = {
  ctx: AffinityContext;
  cutoffs: { high: number; low: number };
  titlesById: ReadonlyMap<string, TonightTitle>;
};

export type Affinity = {
  level: AffinityLevel;
  label: string;
  meaning: string;
  /** 0–1: how much the profile knows (rated watches × features it has seen). */
  confidence: number;
  lowConfidence: boolean;
  /** Up to three, strongest first, in Spanish like Hoy's. */
  reasons: TonightReason[];
};

/** Built once per request; `null` while the profile is too thin (cold start: show nothing). */
export const buildAffinityScorer = (
  titles: readonly TonightTitle[],
  events: readonly TonightEvent[],
  now: Date,
  options: TasteProfileOptions = AFFINITY_PROFILE_OPTIONS,
): AffinityScorer | null => {
  const ctx = buildAffinityContext(titles, events, now, options);
  if (ctx.profile.ratedCount < AFFINITY_MIN_RATED || ctx.profile.vector.size === 0) {
    return null;
  }
  const liked = likedTasteLeaveOneOut(ctx, titles, now, options);
  if (liked.length === 0) {
    return null;
  }
  return {
    ctx,
    cutoffs: {
      high: quantile(liked, LEVEL_HIGH_QUANTILE),
      low: quantile(liked, LEVEL_LOW_QUANTILE),
    },
    titlesById: new Map(titles.map((title) => [title.id, title])),
  };
};

/** Share (by squared weight) of the film's features that appear in the profile. */
export const featureCoverage = (profile: TasteProfile, vector: FeatureVector) => {
  let seen = 0;
  let total = 0;
  for (const [key, value] of vector) {
    const square = value * value;
    total += square;
    if (profile.vector.get(key)) {
      seen += square;
    }
  }
  return total === 0 ? 0 : seen / total;
};

export const levelFor = (taste: number, cutoffs: { high: number; low: number }): AffinityLevel =>
  taste >= cutoffs.high ? "alta" : taste < cutoffs.low ? "baja" : "media";

const genreReason = (
  ctx: AffinityContext,
  title: TonightTitle,
  level: AffinityLevel,
): TonightReason | null => {
  if (title.genres.length === 0 || ctx.genreScale === 0) {
    return null;
  }
  const scored = title.genres.map((genre) => ({
    name: genre.name.toLowerCase(),
    value: (ctx.profile.genreAffinity.get(genre.id) ?? 0) / ctx.genreScale,
  }));
  const liked = scored.filter((genre) => genre.value >= 0.25).sort((a, b) => b.value - a.value);
  if (liked.length > 0 && level !== "baja") {
    const names = liked.slice(0, 2).map((genre) => genre.name);
    return {
      kind: "taste_genre",
      text: `${names.length > 1 ? "Géneros" : "Un género"} que calificas alto: ${joinEs(names)}`,
      weight: 0.05 + liked[0].value * 0.05,
      personal: true,
    };
  }
  const rare = scored.filter((genre) => genre.value < 0.1);
  if (level !== "alta" && rare.length > 0) {
    const names = rare.slice(0, 2).map((genre) => genre.name);
    return {
      kind: "taste_genre",
      text: `Casi no ves ${joinEs(names)}`,
      detail: "Pocas de tus vistas, o con notas bajas",
      weight: 0.06,
      personal: true,
    };
  }
  return null;
};

/** The numbers behind a level: what «Qué vemos juntos» (FIL-I19) averages across people. */
export type AffinityScore = {
  level: AffinityLevel;
  /** The shrunk taste on the user's own scale: 0 at «Fuera de tu zona», 1 at «Muy tu estilo». */
  normalized: number;
  confidence: number;
  taste: number;
  vector: FeatureVector;
};

/** Level and normalized score for a film. Pure; `affinityFor` adds the reasons. */
export const affinityScore = (scorer: AffinityScorer, title: TonightTitle): AffinityScore => {
  const { ctx, cutoffs } = scorer;
  const vector = itemVector(title);
  const taste = cosine(ctx.profile.vector, vector);

  const confidence =
    Math.min(1, ctx.profile.ratedCount / CONFIDENT_RATED) *
    Math.min(1, featureCoverage(ctx.profile, vector) / CONFIDENT_COVERAGE);
  // Shrink toward the middle of your range when the profile knows little about this film.
  const middle = (cutoffs.high + cutoffs.low) / 2;
  const shrunk = middle + (taste - middle) * confidence;
  const span = cutoffs.high - cutoffs.low;
  const normalized = span <= 0 ? 0.5 : Math.min(1, Math.max(0, (shrunk - cutoffs.low) / span));
  return { level: levelFor(shrunk, cutoffs), normalized, confidence, taste, vector };
};

/** The level and its reasons for a film you have not watched. Pure. */
export const affinityFor = (scorer: AffinityScorer, title: TonightTitle): Affinity => {
  const { ctx } = scorer;
  const { level, confidence, taste, vector } = affinityScore(scorer, title);

  const gusto = Math.min(1, Math.max(0, 0.5 + taste * GUSTO_SCALE));
  const reasons: TonightReason[] = tasteReasons(title, vector, gusto, ctx.profile, scorer.titlesById);
  const genre = genreReason(ctx, title, level);
  if (genre) {
    reasons.push(genre);
  }
  const weighted = bayesianQuality(title.imdbRating, title.imdbVotes, ctx.qualityPrior);
  if (title.imdbRating != null && weighted != null && weighted >= QUALITY_REASON_MIN) {
    reasons.push({
      kind: "quality",
      text: `IMDb ${title.imdbRating.toFixed(1)}`,
      detail: title.imdbVotes ? formatVotes(title.imdbVotes) : undefined,
      weight: 0.04,
      personal: false,
    });
  }
  reasons.sort((a, b) => b.weight - a.weight);

  return {
    level,
    label: AFFINITY_LABEL[level],
    meaning: AFFINITY_MEANING[level],
    confidence,
    lowConfidence: confidence < LOW_CONFIDENCE,
    reasons: reasons.slice(0, AFFINITY_REASON_LIMIT),
  };
};
