import type { TonightTitle } from "@/lib/tonight/types";

/** Sparse feature vector keyed by `g:18`, `k:4565`, `p:525`, `d:1980`… */
export type FeatureVector = Map<string, number>;

export const FEATURE_WEIGHTS = {
  genre: 1,
  keyword: 0.6,
  director: 1.2,
  creator: 1,
  cast: 0.5,
  decade: 0.4,
  language: 0.3,
  kind: 0.2,
} as const;

export const KEYWORD_CAP = 15;
export const CAST_CAP = 5;

const bump = (vector: FeatureVector, key: string, value: number) => {
  vector.set(key, (vector.get(key) ?? 0) + value);
};

export const decadeOf = (year: number | null | undefined) =>
  year ? Math.floor(year / 10) * 10 : null;

/** Content vector of one title (pure; no normalization). */
export const itemVector = (title: TonightTitle): FeatureVector => {
  const vector: FeatureVector = new Map();

  for (const genre of title.genres) {
    bump(vector, `g:${genre.id}`, FEATURE_WEIGHTS.genre);
  }

  for (const keyword of title.keywords.slice(0, KEYWORD_CAP)) {
    bump(vector, `k:${keyword.id}`, FEATURE_WEIGHTS.keyword);
  }

  let castSeen = 0;
  for (const person of title.people) {
    if (person.role === "cast") {
      if (castSeen >= CAST_CAP) {
        continue;
      }
      castSeen += 1;
      bump(vector, `p:${person.id}`, FEATURE_WEIGHTS.cast);
      continue;
    }
    bump(
      vector,
      `p:${person.id}`,
      person.role === "director" ? FEATURE_WEIGHTS.director : FEATURE_WEIGHTS.creator,
    );
  }

  const decade = decadeOf(title.year);
  if (decade) {
    bump(vector, `d:${decade}`, FEATURE_WEIGHTS.decade);
  }

  if (title.originalLanguage) {
    bump(vector, `l:${title.originalLanguage}`, FEATURE_WEIGHTS.language);
  }

  bump(vector, `kind:${title.kind}`, FEATURE_WEIGHTS.kind);

  return vector;
};

export const addScaled = (target: FeatureVector, source: FeatureVector, scale: number) => {
  if (scale === 0) {
    return target;
  }
  for (const [key, value] of source) {
    bump(target, key, value * scale);
  }
  return target;
};

export const norm = (vector: FeatureVector) => {
  let sum = 0;
  for (const value of vector.values()) {
    sum += value * value;
  }
  return Math.sqrt(sum);
};

export const cosine = (a: FeatureVector, b: FeatureVector) => {
  if (a.size === 0 || b.size === 0) {
    return 0;
  }
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  let dot = 0;
  for (const [key, value] of small) {
    const other = large.get(key);
    if (other) {
      dot += value * other;
    }
  }
  const denominator = norm(a) * norm(b);
  return denominator === 0 ? 0 : dot / denominator;
};

export const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));
