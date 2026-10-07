import { FAVORITAS_SLUG, POR_REWATCH_SLUG } from "@/lib/lists";
import { PLATFORM_SERVICE_LABEL } from "@/lib/labels";
import { clamp01, cosine, type FeatureVector } from "@/lib/tonight/features";
import { closestAnchor, type TasteProfile } from "@/lib/tonight/profile";
import {
  daysBetween,
  FIT_GATE_MINUTES,
  FIT_GATE_MULTIPLIER,
  fitForRuntime,
  formatRuntimeShort,
  monthsBetween,
  TYPICAL_EVENING_MINUTES,
} from "@/lib/tonight/time";
import type {
  TonightComponents,
  TonightEvent,
  TonightPickBase,
  TonightQueueEntry,
  TonightReason,
  TonightTitle,
} from "@/lib/tonight/types";

export const WEIGHTS = {
  gusto: 0.3,
  calidad: 0.2,
  encaje: 0.2,
  impulso: 0.15,
  novedad: 0.1,
  reposo: 0.05,
} as const;

export const QUALITY_M = 3000;
export const QUALITY_DEFAULT_VOTES = 1000;
export const QUALITY_FALLBACK_C = 6.9;
export const NOT_TONIGHT_DAYS = 14;
export const IMPRESSION_WINDOW_DAYS = 30;
export const FATIGUE_BASE = 0.85;
export const FATIGUE_FLOOR = 0.4;
export const AGING_MONTHS_FULL = 18;
export const AGING_REASON_MONTHS = 3;
export const FRESH_PLATFORM_DAYS = 14;
export const FRESH_ADDED_DAYS = 7;
export const ANCHOR_MIN_SIMILARITY = 0.22;
export const QUALITY_REASON_MIN = 7.8;
export const NOTE_MAX = 64;

/** IMDb's weighted rating: shrink toward C with m pseudo-votes. */
export const bayesianQuality = (
  rating: number | null | undefined,
  votes: number | null | undefined,
  prior = QUALITY_FALLBACK_C,
) => {
  if (rating == null) {
    return null;
  }
  const v = votes && votes > 0 ? votes : QUALITY_DEFAULT_VOTES;
  return (v / (v + QUALITY_M)) * rating + (QUALITY_M / (v + QUALITY_M)) * prior;
};

export const qualityScore = (
  rating: number | null | undefined,
  votes: number | null | undefined,
  prior = QUALITY_FALLBACK_C,
) => {
  const weighted = bayesianQuality(rating, votes, prior);
  if (weighted == null) {
    return 0.45;
  }
  return clamp01((weighted - 5) / 4);
};

export const meanImdb = (titles: readonly { imdbRating: number | null }[]) => {
  const rated = titles.filter((title) => title.imdbRating != null);
  if (rated.length === 0) {
    return QUALITY_FALLBACK_C;
  }
  return rated.reduce((sum, title) => sum + (title.imdbRating ?? 0), 0) / rated.length;
};

export const formatVotes = (votes: number) => {
  if (votes >= 1_000_000) {
    return `${(votes / 1_000_000).toFixed(1).replace(".", ",")} M de votos`;
  }
  if (votes >= 1_000) {
    return `${Math.round(votes / 1_000)} mil votos`;
  }
  return `${votes} votos`;
};

export const isExcludedNotTonight = (events: readonly TonightEvent[], now: Date) =>
  events.some(
    (event) =>
      event.kind === "not_tonight" && daysBetween(event.createdAt, now) < NOT_TONIGHT_DAYS,
  );

/** 0.85 per night it was shown without being chosen (skips count half); floor 0.4. */
export const fatigueMultiplier = (events: readonly TonightEvent[], now: Date) => {
  const shownDays = new Set<string>();
  let skips = 0;
  for (const event of events) {
    if (daysBetween(event.createdAt, now) > IMPRESSION_WINDOW_DAYS) {
      continue;
    }
    if (event.kind === "shown") {
      shownDays.add(event.createdAt.toISOString().slice(0, 10));
    } else if (event.kind === "skipped") {
      skips += 1;
    } else if (event.kind === "opened" || event.kind === "more_like") {
      // Interest resets fatigue a little.
      skips -= 1;
    }
  }
  const exponent = shownDays.size + Math.max(0, skips) * 0.5;
  return Math.max(FATIGUE_FLOOR, Math.pow(FATIGUE_BASE, exponent));
};

const platformLabel = (title: TonightTitle) =>
  title.platform ? PLATFORM_SERVICE_LABEL[title.platform] : (title.flatrate[0]?.name ?? null);

export const impulseScore = (
  title: TonightTitle,
  entry: TonightQueueEntry | undefined,
): { value: number; reasons: TonightReason[] } => {
  const reasons: TonightReason[] = [];
  let value = 0;

  if (title.kind === "SERIES" && title.seriesStatus === "WATCHING") {
    value = Math.max(value, 1);
    const episode = formatRuntimeShort(title.runtimeMinutes);
    reasons.push({
      kind: "series",
      text: title.seriesSeason
        ? `Vas en la temporada ${title.seriesSeason}`
        : "La tienes a medias",
      detail: episode ? `Un capítulo son ${episode}` : undefined,
      weight: WEIGHTS.impulso,
      personal: true,
    });
  }

  if (title.listSlugs.includes(POR_REWATCH_SLUG)) {
    value = Math.max(value, 0.7);
    reasons.push({
      kind: "rewatch",
      text: "Está en Por rewatch",
      weight: WEIGHTS.impulso * 0.7,
      personal: true,
    });
  }

  const note = entry?.queueNote?.trim();
  if (note) {
    value = Math.max(value, 0.5);
    const short = note.length > NOTE_MAX ? `${note.slice(0, NOTE_MAX - 1)}…` : note;
    reasons.push({
      kind: "note",
      text: `Tu nota al guardarla: «${short}»`,
      weight: WEIGHTS.impulso * 0.6,
      personal: true,
    });
  }

  if (entry) {
    if (entry.position === 0) {
      value = Math.max(value, 0.6);
      reasons.push({
        kind: "position",
        text: "La pusiste primera en Quiero ver",
        weight: WEIGHTS.impulso * 0.5,
        personal: true,
      });
    } else if (entry.position <= 2) {
      value = Math.max(value, 0.4);
      reasons.push({
        kind: "position",
        text: "La pusiste de las primeras en Quiero ver",
        weight: WEIGHTS.impulso * 0.35,
        personal: true,
      });
    } else if (entry.position <= 5) {
      value = Math.max(value, 0.2);
    }
  }

  return { value, reasons };
};

export const freshnessScore = (
  title: TonightTitle,
  entry: TonightQueueEntry | undefined,
  now: Date,
): { value: number; reasons: TonightReason[] } => {
  const reasons: TonightReason[] = [];
  let value = 0;

  if (title.availableSince) {
    const days = daysBetween(title.availableSince, now);
    if (days <= FRESH_PLATFORM_DAYS) {
      value = Math.max(value, 1 - (days / FRESH_PLATFORM_DAYS) * 0.5);
      const label = platformLabel(title);
      reasons.push({
        kind: "fresh_platform",
        text: label ? `Acaba de llegar a ${label}` : "Acaba de llegar a tus plataformas",
        weight: WEIGHTS.novedad * value,
        personal: false,
      });
    }
  }

  if (entry) {
    const days = daysBetween(entry.addedAt, now);
    if (days <= FRESH_ADDED_DAYS) {
      value = Math.max(value, 0.8 - (days / FRESH_ADDED_DAYS) * 0.4);
      reasons.push({
        kind: "fresh_added",
        text: "La añadiste esta semana",
        weight: WEIGHTS.novedad * 0.5,
        personal: true,
      });
    }
  }

  return { value, reasons };
};

export const agingScore = (
  title: TonightTitle,
  entry: TonightQueueEntry | undefined,
  now: Date,
): { value: number; reasons: TonightReason[] } => {
  if (!entry || title.kind === "SERIES") {
    return { value: 0, reasons: [] };
  }
  const months = monthsBetween(entry.addedAt, now);
  const value = clamp01(months / AGING_MONTHS_FULL);
  const reasons: TonightReason[] = [];
  if (months >= AGING_REASON_MONTHS) {
    const whole = Math.floor(months);
    reasons.push({
      kind: "aging",
      text:
        whole >= 12
          ? "Lleva más de un año esperando en Quiero ver"
          : `Lleva ${whole} meses esperando en Quiero ver`,
      weight: WEIGHTS.reposo * value + 0.02,
      personal: true,
    });
  }
  return { value, reasons };
};

const sharedFeatureNames = (a: TonightTitle, b: TonightTitle) => {
  const names: string[] = [];
  const genresB = new Set(b.genres.map((genre) => genre.id));
  for (const genre of a.genres) {
    if (genresB.has(genre.id)) {
      names.push(genre.name.toLowerCase());
    }
  }
  const keywordsB = new Set(b.keywords.map((keyword) => keyword.id));
  for (const keyword of a.keywords) {
    if (keywordsB.has(keyword.id)) {
      names.push(keyword.name.toLowerCase());
    }
  }
  return [...new Set(names)].slice(0, 3);
};

const joinEs = (parts: string[]) => {
  if (parts.length <= 1) {
    return parts.join("");
  }
  return `${parts.slice(0, -1).join(", ")} y ${parts.at(-1)}`;
};

export const tasteReasons = (
  title: TonightTitle,
  vector: FeatureVector,
  gusto: number,
  profile: TasteProfile,
  titlesById: ReadonlyMap<string, TonightTitle>,
): TonightReason[] => {
  const reasons: TonightReason[] = [];

  const anchor = closestAnchor(profile, vector);
  if (anchor && anchor.similarity >= ANCHOR_MIN_SIMILARITY && anchor.anchor.titleId !== title.id) {
    const other = titlesById.get(anchor.anchor.titleId);
    const shared = other ? sharedFeatureNames(title, other) : [];
    reasons.push({
      kind: "taste_anchor",
      text:
        anchor.anchor.rating != null
          ? `Porque le diste ${formatStarsCompact(anchor.anchor.rating)} a ${anchor.anchor.name}`
          : `Porque ${anchor.anchor.name} está en tus Favoritas`,
      detail: shared.length > 0 ? `Comparten ${joinEs(shared)}` : undefined,
      weight: WEIGHTS.gusto * gusto + anchor.similarity * 0.1,
      personal: true,
    });
  }

  for (const person of title.people) {
    if (person.role === "cast") {
      continue;
    }
    const known = profile.people.get(person.id);
    if (known && known.count >= 2) {
      const avg =
        known.avgRating != null ? ` · nota media ${formatStarsCompact(known.avgRating)}` : "";
      reasons.push({
        kind: "taste_person",
        text: `${title.kind === "SERIES" ? "Creada" : "Dirigida"} por ${person.name}`,
        detail: `Has visto ${known.count} suyas${avg}`,
        weight: WEIGHTS.gusto * gusto * 0.6 + 0.02,
        personal: true,
      });
      break;
    }
  }

  return reasons;
};

export type ScoreContext = {
  profile: TasteProfile;
  titlesById: ReadonlyMap<string, TonightTitle>;
  queueById: ReadonlyMap<string, TonightQueueEntry>;
  eventsByTitle: ReadonlyMap<string, TonightEvent[]>;
  qualityPrior: number;
  now: Date;
};

/** Stars as the UI shows them: 10 → «5★», 9 → «4.5★». */
export const formatStarsCompact = (rating: number) => {
  const stars = rating / 2;
  return `${Number.isInteger(stars) ? stars : stars.toFixed(1)}★`;
};

export const combineScore = (
  components: TonightComponents,
  fit: number,
  overflowMinutes = 0,
) =>
  (WEIGHTS.gusto * components.gusto +
    WEIGHTS.calidad * components.calidad +
    WEIGHTS.encaje * fit +
    WEIGHTS.impulso * components.impulso +
    WEIGHTS.novedad * components.novedad +
    WEIGHTS.reposo * components.reposo) *
  components.fatiga *
  (overflowMinutes > FIT_GATE_MINUTES ? FIT_GATE_MULTIPLIER : 1);

export const scoreCandidate = (
  title: TonightTitle,
  vector: FeatureVector,
  gusto: number,
  ctx: ScoreContext,
): TonightPickBase => {
  const entry = ctx.queueById.get(title.id);
  const events = ctx.eventsByTitle.get(title.id) ?? [];
  const calidad = qualityScore(title.imdbRating, title.imdbVotes, ctx.qualityPrior);
  const impulse = impulseScore(title, entry);
  const fresh = freshnessScore(title, entry, ctx.now);
  const aging = agingScore(title, entry, ctx.now);
  const fatiga = fatigueMultiplier(events, ctx.now);

  const components: TonightComponents = {
    gusto,
    calidad,
    impulso: impulse.value,
    novedad: fresh.value,
    reposo: aging.value,
    fatiga,
  };

  const reasons: TonightReason[] = [
    ...tasteReasons(title, vector, gusto, ctx.profile, ctx.titlesById),
    ...impulse.reasons,
    ...fresh.reasons,
    ...aging.reasons,
  ];

  const weighted = bayesianQuality(title.imdbRating, title.imdbVotes, ctx.qualityPrior);
  if (title.imdbRating != null && weighted != null && weighted >= QUALITY_REASON_MIN) {
    reasons.push({
      kind: "quality",
      text: `IMDb ${title.imdbRating.toFixed(1)}`,
      detail: title.imdbVotes ? formatVotes(title.imdbVotes) : undefined,
      weight: WEIGHTS.calidad * calidad,
      personal: false,
    });
  }

  reasons.sort((a, b) => b.weight - a.weight);

  const typical = fitForRuntime(title.runtimeMinutes, TYPICAL_EVENING_MINUTES, ctx.now);

  return {
    titleId: title.id,
    components,
    baseScore: combineScore(components, typical.fit, typical.overflowMinutes),
    reasons,
    wildcard: false,
  };
};

/** Similarity between two candidates (for MMR). */
export const candidateSimilarity = (a: FeatureVector, b: FeatureVector) => clamp01(cosine(a, b));

export const isFavorite = (title: TonightTitle) => title.listSlugs.includes(FAVORITAS_SLUG);
