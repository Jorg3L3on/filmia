import { clamp01, cosine, itemVector } from "@/lib/tonight/features";

/** How far a cosine of ±0.4 moves gusto from the neutral 0.5. */
export const GUSTO_SCALE = 1.25;
import { buildTasteProfile } from "@/lib/tonight/profile";
import {
  isExcludedNotTonight,
  meanImdb,
  scoreCandidate,
  type ScoreContext,
} from "@/lib/tonight/score";
import { buildLenses, type ScoredCandidate } from "@/lib/tonight/select";
import type {
  TonightEvent,
  TonightInput,
  TonightResult,
  TonightTitle,
} from "@/lib/tonight/types";

export * from "@/lib/tonight/types";
export { WEIGHTS, combineScore, fatigueMultiplier } from "@/lib/tonight/score";
export { PARA_TI_SLUG, PARA_TI_NAME, LENS_SIZE } from "@/lib/tonight/select";
export {
  DAY_PART_LABEL,
  DEFAULT_NIGHT_ENDS,
  type DayPart,
  bedtimeFor,
  dayPartOf,
  fitForRuntime,
  isNight,
  nextDayPartChange,
  formatRuntimeShort,
  isWeekendNight,
  nightEndsLabel,
  parseNightEnds,
  remainingMinutes,
} from "@/lib/tonight/time";

const groupEvents = (events: readonly TonightEvent[]) => {
  const map = new Map<string, TonightEvent[]>();
  for (const event of events) {
    const bucket = map.get(event.titleId);
    if (bucket) {
      bucket.push(event);
    } else {
      map.set(event.titleId, [event]);
    }
  }
  return map;
};

export const isTonightCandidate = (
  title: TonightTitle,
  queued: boolean,
  events: readonly TonightEvent[],
  now: Date,
) =>
  queued &&
  title.watchedAt == null &&
  title.availableOnMine &&
  !(title.kind === "SERIES" && title.seriesStatus === "DROPPED") &&
  !isExcludedNotTonight(events, now);

/** Rank the queue for tonight: filter → taste profile → score → MMR lenses. Pure. */
export const computeTonight = (input: TonightInput): TonightResult => {
  const { now } = input;
  const titlesById = new Map(input.titles.map((title) => [title.id, title]));
  const queueById = new Map(input.queue.map((entry) => [entry.titleId, entry]));
  const eventsByTitle = groupEvents(input.events);

  const candidates = input.titles.filter((title) =>
    isTonightCandidate(title, queueById.has(title.id), eventsByTitle.get(title.id) ?? [], now),
  );

  const profile = buildTasteProfile(input.titles, input.events, now);
  const vectors = new Map(candidates.map((title) => [title.id, itemVector(title)]));

  // Cosine centered on 0.5 so a neutral title scores half, a close one ~1, a disliked one ~0.
  const gustoFor = (titleId: string) => {
    if (profile.vector.size === 0) {
      return 0.5;
    }
    return clamp01(0.5 + cosine(profile.vector, vectors.get(titleId)!) * GUSTO_SCALE);
  };

  const ctx: ScoreContext = {
    profile,
    titlesById,
    queueById,
    eventsByTitle,
    qualityPrior: meanImdb(candidates),
    now,
  };

  const scored: ScoredCandidate[] = candidates.map((title) => {
    const vector = vectors.get(title.id)!;
    return {
      title,
      vector,
      pick: scoreCandidate(title, vector, gustoFor(title.id), ctx),
    };
  });

  return {
    lenses: buildLenses(scored, profile),
    profileSize: profile.size,
    computedAt: now,
  };
};
