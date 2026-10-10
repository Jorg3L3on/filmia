import {
  addScaled,
  clamp,
  cosine,
  itemVector,
  type FeatureVector,
} from "@/lib/tonight/features";
import { monthsBetween } from "@/lib/tonight/time";
import type { TonightEvent, TonightTitle } from "@/lib/tonight/types";
import { FAVORITAS_SLUG, POR_REWATCH_SLUG } from "@/lib/lists";

export type TasteAnchor = {
  titleId: string;
  name: string;
  rating: number | null;
  vector: FeatureVector;
  weight: number;
};

export type PersonAffinity = {
  id: number;
  name: string;
  count: number;
  avgRating: number | null;
};

export type TasteProfile = {
  vector: FeatureVector;
  /** Mean personal rating (1–10) over rated titles; 7 when fewer than 3 ratings. */
  mean: number;
  ratedCount: number;
  size: number;
  anchors: TasteAnchor[];
  genreAffinity: Map<number, number>;
  people: Map<number, PersonAffinity>;
};

export const RECENCY_HALF_LIFE_MONTHS = 18;
export const RECENCY_FLOOR = 0.15;
export const UNRATED_WEIGHT = 0.3;
export const DROPPED_WEIGHT = -0.8;
export const FEEDBACK_NUDGE = 0.5;
export const ANCHOR_MIN_RATING = 8;
export const ANCHOR_LIMIT = 16;
/** Quiero ver says what you want, not what you liked: half the weight of a neutral watch. */
export const QUEUE_WEIGHT = 0.5;

export const recencyWeight = (watchedAt: Date | null, now: Date) => {
  if (!watchedAt) {
    return 0.6;
  }
  const months = monthsBetween(watchedAt, now);
  return Math.max(RECENCY_FLOOR, Math.pow(0.5, months / RECENCY_HALF_LIFE_MONTHS));
};

/** Base weight of a watched title: how much it says about your taste, signed. */
export const titleTasteWeight = (title: TonightTitle, mean: number) => {
  if (title.kind === "SERIES" && title.seriesStatus === "DROPPED") {
    return DROPPED_WEIGHT;
  }
  let weight =
    title.rating == null ? UNRATED_WEIGHT : clamp((title.rating - mean) / 2, -1.5, 1.5);
  if (title.listSlugs.includes(FAVORITAS_SLUG)) {
    weight = Math.max(weight, 0.8) * 1.5;
  } else if (title.listSlugs.includes(POR_REWATCH_SLUG)) {
    weight = Math.max(weight, 0.6) * 1.2;
  }
  return weight;
};

export const buildTasteProfile = (
  titles: readonly TonightTitle[],
  events: readonly TonightEvent[],
  now: Date,
): TasteProfile => {
  const watched = titles.filter((title) => title.watchedAt != null);
  const rated = watched.filter((title) => title.rating != null);
  const mean =
    rated.length >= 3
      ? rated.reduce((sum, title) => sum + (title.rating ?? 0), 0) / rated.length
      : 7;

  const vector: FeatureVector = new Map();
  const genreAffinity = new Map<number, number>();
  const people = new Map<number, PersonAffinity>();
  const anchors: TasteAnchor[] = [];

  for (const title of watched) {
    const weight = titleTasteWeight(title, mean) * recencyWeight(title.watchedAt, now);
    if (weight === 0) {
      continue;
    }
    const itemVec = itemVector(title);
    addScaled(vector, itemVec, weight);

    for (const genre of title.genres) {
      genreAffinity.set(genre.id, (genreAffinity.get(genre.id) ?? 0) + weight);
    }
    for (const person of title.people) {
      if (person.role === "cast") {
        continue;
      }
      const current = people.get(person.id) ?? {
        id: person.id,
        name: person.name,
        count: 0,
        avgRating: null,
      };
      const ratings = current.avgRating == null ? [] : [current.avgRating * current.count];
      const total = (ratings[0] ?? 0) + (title.rating ?? 0);
      const ratedCount = (current.avgRating == null ? 0 : current.count) + (title.rating == null ? 0 : 1);
      people.set(person.id, {
        ...current,
        count: current.count + 1,
        avgRating: ratedCount > 0 ? total / ratedCount : current.avgRating,
      });
    }

    const isFavorite = title.listSlugs.includes(FAVORITAS_SLUG);
    if ((title.rating != null && title.rating >= ANCHOR_MIN_RATING) || isFavorite) {
      anchors.push({
        titleId: title.id,
        name: title.name,
        rating: title.rating,
        vector: itemVec,
        weight,
      });
    }
  }

  // Más así / Menos así nudge the profile toward or away from that title's features.
  const byId = new Map(titles.map((title) => [title.id, title]));
  for (const event of events) {
    if (event.kind !== "more_like" && event.kind !== "less_like") {
      continue;
    }
    const title = byId.get(event.titleId);
    if (!title) {
      continue;
    }
    addScaled(vector, itemVector(title), event.kind === "more_like" ? FEEDBACK_NUDGE : -FEEDBACK_NUDGE);
  }

  anchors.sort((a, b) => b.weight - a.weight);

  return {
    vector,
    mean,
    ratedCount: rated.length,
    size: watched.length,
    anchors: anchors.slice(0, ANCHOR_LIMIT),
    genreAffinity,
    people,
  };
};

/** Watched title closest to this one — the «Porque le diste 5★ a…» anchor. */
export const closestAnchor = (profile: TasteProfile, vector: FeatureVector) => {
  let best: { anchor: TasteAnchor; similarity: number } | null = null;
  for (const anchor of profile.anchors) {
    const similarity = cosine(anchor.vector, vector);
    if (!best || similarity > best.similarity) {
      best = { anchor, similarity };
    }
  }
  return best;
};

/**
 * The profile as recommendations see it: what you watched plus what you saved for later, the
 * latter at `QUEUE_WEIGHT` and fading with how long ago you added it. Someone with no watches
 * and a few saved films still gets a taste. The queue's own ranking keeps the plain profile,
 * so adding this changes nothing for the titles already in Quiero ver.
 */
export const withQueueTaste = (
  profile: TasteProfile,
  queued: ReadonlyArray<{ title: TonightTitle; addedAt: Date }>,
  now: Date,
): TasteProfile => {
  if (queued.length === 0) {
    return profile;
  }
  const vector: FeatureVector = new Map(profile.vector);
  const genreAffinity = new Map(profile.genreAffinity);
  for (const { title, addedAt } of queued) {
    const weight = QUEUE_WEIGHT * recencyWeight(addedAt, now);
    addScaled(vector, itemVector(title), weight);
    for (const genre of title.genres) {
      genreAffinity.set(genre.id, (genreAffinity.get(genre.id) ?? 0) + weight);
    }
  }
  return { ...profile, vector, genreAffinity, size: profile.size + queued.length };
};
