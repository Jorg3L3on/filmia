import { AFFINITY_MIN_RATED, LIKED_MIN_RATING } from "@/lib/tonight/affinity";
import { cosine, type FeatureVector } from "@/lib/tonight/features";

/**
 * FIL-I19-2 · «% de compatibilidad» between two people on a shared list, Spotify
 * Blend style. Pure: the store loads each person's ratings and taste vector.
 *
 * With enough films rated by both: Spearman over those ratings, shrunk toward 0
 * by how few they are, mapped to 5–95 % in steps of 5. With fewer: the cosine
 * of the two taste profiles, shown with «~» («por gustos parecidos»). With a
 * thin profile on either side: nothing.
 */

/** Films rated by both before the % is a real comparison (pinned decision: 8). */
export const COMPAT_MIN_COMMON = AFFINITY_MIN_RATED;
/** `r' = r·n/(n + k)`: with 8 in common a perfect match reads as 0.44, not 1. */
export const COMPAT_SHRINK = 10;
export const COMPAT_MIN_PERCENT = 5;
export const COMPAT_MAX_PERCENT = 95;
export const COMPAT_STEP = 5;
/** «Ambos aman»: both rated it this high (4★). */
export const COMPAT_LOVE_RATING = 8;
/** «Donde no coinciden»: at least this far apart (2★). */
export const COMPAT_DISAGREE_GAP = 4;

export type CompatPerson = {
  /** `catalogId → rating (1–10)` of every rated watch. */
  ratings: ReadonlyMap<string, number>;
  /** The affinity taste vector (`TasteProfile.vector`); empty when unknown. */
  vector: FeatureVector;
  /** Genre id → affinity (−1…1), for «géneros que comparten». */
  genreAffinity?: ReadonlyMap<number, number>;
};

export type CompatFilm = { catalogId: string; ratingA: number; ratingB: number };

export type Compat = {
  percent: number;
  /** True for the profile fallback: shown with «~» and «por gustos parecidos». */
  approx: boolean;
  /** Films rated by both. */
  common: number;
  /** Up to three both loved, best first. */
  bothLove: string[];
  /** The one they disagree on most (only shown inside the app), or null. */
  disagree: string | null;
  /** Genre ids both rate high. */
  sharedGenreIds: number[];
};

/** Average ranks (1-based), ties share the mean of their positions. */
export const ranks = (values: readonly number[]): number[] => {
  const order = values.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value);
  const result = new Array<number>(values.length);
  let start = 0;
  while (start < order.length) {
    let end = start;
    while (end + 1 < order.length && order[end + 1].value === order[start].value) {
      end += 1;
    }
    const rank = (start + end) / 2 + 1;
    for (let i = start; i <= end; i += 1) {
      result[order[i].index] = rank;
    }
    start = end + 1;
  }
  return result;
};

const pearson = (xs: readonly number[], ys: readonly number[]) => {
  const n = xs.length;
  if (n < 2) {
    return 0;
  }
  const mx = xs.reduce((sum, x) => sum + x, 0) / n;
  const my = ys.reduce((sum, y) => sum + y, 0) / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i += 1) {
    num += (xs[i] - mx) * (ys[i] - my);
    dx += (xs[i] - mx) ** 2;
    dy += (ys[i] - my) ** 2;
  }
  // Someone who rates everything the same says nothing about order: no correlation.
  return dx === 0 || dy === 0 ? 0 : num / Math.sqrt(dx * dy);
};

/** Spearman's rho with tie correction (Pearson over average ranks). */
export const spearman = (xs: readonly number[], ys: readonly number[]) =>
  pearson(ranks(xs), ranks(ys));

/** `r` (−1…1) → 5–95 %, rounded to 5. */
export const percentOf = (r: number) => {
  const raw = 50 + 50 * Math.max(-1, Math.min(1, r));
  const stepped = Math.round(raw / COMPAT_STEP) * COMPAT_STEP;
  return Math.max(COMPAT_MIN_PERCENT, Math.min(COMPAT_MAX_PERCENT, stepped));
};

export const shrink = (r: number, n: number) => (r * n) / (n + COMPAT_SHRINK);

export const commonFilms = (a: CompatPerson, b: CompatPerson): CompatFilm[] => {
  const films: CompatFilm[] = [];
  for (const [catalogId, ratingA] of a.ratings) {
    const ratingB = b.ratings.get(catalogId);
    if (ratingB != null) {
      films.push({ catalogId, ratingA, ratingB });
    }
  }
  return films;
};

const sharedGenres = (a: CompatPerson, b: CompatPerson) => {
  if (!a.genreAffinity || !b.genreAffinity) {
    return [];
  }
  const shared: { id: number; value: number }[] = [];
  for (const [id, valueA] of a.genreAffinity) {
    const valueB = b.genreAffinity.get(id);
    if (valueB != null && valueA > 0 && valueB > 0) {
      shared.push({ id, value: Math.min(valueA, valueB) });
    }
  }
  return shared.sort((x, y) => y.value - x.value).slice(0, 3).map((genre) => genre.id);
};

/** Two people's compatibility, or null when either has too thin a profile. */
export const compatibility = (a: CompatPerson, b: CompatPerson): Compat | null => {
  if (a.ratings.size < AFFINITY_MIN_RATED || b.ratings.size < AFFINITY_MIN_RATED) {
    return null;
  }
  const films = commonFilms(a, b);
  const bothLove = films
    .filter((film) => film.ratingA >= COMPAT_LOVE_RATING && film.ratingB >= COMPAT_LOVE_RATING)
    .sort((x, y) => Math.min(y.ratingA, y.ratingB) - Math.min(x.ratingA, x.ratingB) || y.ratingA + y.ratingB - (x.ratingA + x.ratingB))
    .slice(0, 3)
    .map((film) => film.catalogId);
  const disagreement = films
    .map((film) => ({ film, gap: Math.abs(film.ratingA - film.ratingB) }))
    .filter(({ film, gap }) => gap >= COMPAT_DISAGREE_GAP && Math.max(film.ratingA, film.ratingB) >= LIKED_MIN_RATING)
    .sort((x, y) => y.gap - x.gap)[0];
  const extras = {
    common: films.length,
    bothLove,
    disagree: disagreement?.film.catalogId ?? null,
    sharedGenreIds: sharedGenres(a, b),
  };

  if (films.length >= COMPAT_MIN_COMMON) {
    const r = spearman(
      films.map((film) => film.ratingA),
      films.map((film) => film.ratingB),
    );
    return { percent: percentOf(shrink(r, films.length)), approx: false, ...extras };
  }
  if (a.vector.size === 0 || b.vector.size === 0) {
    return null;
  }
  return { percent: percentOf(cosine(a.vector, b.vector)), approx: true, ...extras };
};

/** The group's %: the mean of every pair that has one, rounded the same way. */
export const groupCompatibility = (pairs: readonly (Compat | null)[]) => {
  const known = pairs.filter((pair): pair is Compat => pair != null);
  if (known.length === 0) {
    return null;
  }
  const mean = known.reduce((sum, pair) => sum + pair.percent, 0) / known.length;
  const stepped = Math.round(mean / COMPAT_STEP) * COMPAT_STEP;
  return {
    percent: Math.max(COMPAT_MIN_PERCENT, Math.min(COMPAT_MAX_PERCENT, stepped)),
    approx: known.some((pair) => pair.approx),
    pairs: known.length,
  };
};

/** «72 % compatibles» / «~70 % · por gustos parecidos». */
export const compatLabel = (compat: { percent: number; approx: boolean }) =>
  `${compat.approx ? "~" : ""}${compat.percent} %`;
