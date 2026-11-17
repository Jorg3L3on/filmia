import type { Platform, TitleKind } from "@/db/schema";
import { primaryAvailabilityPlatform, titleAvailableOnUserPlatforms } from "@/lib/streaming-platforms";
import {
  affinityFor,
  affinityScore,
  filmAsTitle,
  type AffinityLevel,
  type AffinityScorer,
} from "@/lib/tonight/affinity";
import { cosine, itemVector, type FeatureVector } from "@/lib/tonight/features";
import type { TonightGenre, TonightKeyword, TonightPerson } from "@/lib/tonight/types";
import type { WatchProvidersMxData } from "@/lib/watch-providers";

/**
 * Para ti's reading (FIL-I60-3), pure: a pool of candidates in, the person's ranked titles out.
 * Excludes what they own or dismissed, applies kind / era / runtime / platform filters, and
 * orders by taste (the Afinidad scorer) blended with quality, or by quality alone at cold start.
 * The order is stable for the same input within a day and moves a little from day to day.
 */

export type ParaTiCandidate = {
  catalogId: string;
  tmdbId: number;
  kind: TitleKind;
  name: string;
  year: number | null;
  posterPath: string | null;
  posterAmbient: string | null;
  runtimeMinutes: number | null;
  imdbRating: number | null;
  imdbVotes: number | null;
  rtScore: number | null;
  /** TMDB's average and votes (pool payload), quality before OMDb has seen it. */
  voteAverage: number | null;
  voteCount: number;
  /** Rank in its pool (0 first): TMDB's popularity order, a small prior. */
  poolRank: number;
  genres: readonly TonightGenre[];
  keywords: readonly TonightKeyword[];
  people: readonly TonightPerson[];
  originalLanguage: string | null;
  providers: WatchProvidersMxData | null;
  availableSince: Date | null;
};

export const ERAS = [
  { id: "2020s", label: "2020s", from: 2020, to: 2029 },
  { id: "2010s", label: "2010s", from: 2010, to: 2019 },
  { id: "2000s", label: "2000s", from: 2000, to: 2009 },
  { id: "1990s", label: "90s", from: 1990, to: 1999 },
  { id: "clasicos", label: "Clásicos", from: 0, to: 1989 },
] as const;
export type EraId = (typeof ERAS)[number]["id"];

/** Runtime ceilings the filter offers, minutes. */
export const RUNTIMES = [90, 120] as const;
export type RuntimeCeiling = (typeof RUNTIMES)[number];

export type ParaTiFilters = {
  kind: TitleKind | null;
  era: EraId | null;
  maxRuntime: RuntimeCeiling | null;
  /** Only titles included on one of the user's platforms (default on). */
  onlyMine: boolean;
};

export const DEFAULT_FILTERS: ParaTiFilters = { kind: null, era: null, maxRuntime: null, onlyMine: true };

export type ParaTiAffinity = { level: AffinityLevel; label: string; lowConfidence: boolean };

/** What a spine and the centred card need. */
export type ParaTiTitle = {
  catalogId: string;
  tmdbId: number;
  kind: TitleKind;
  name: string;
  year: number | null;
  posterPath: string | null;
  posterAmbient: string | null;
  runtimeMinutes: number | null;
  imdbRating: number | null;
  rtScore: number | null;
  /** Where it streams: the user's platform first, else the first known one. */
  platform: Platform | null;
  affinity: ParaTiAffinity | null;
  reason: string | null;
};

export type RankContext = {
  /** Catalog ids the user owns (watched, Quiero ver, dropped, any list) or dismissed. */
  excluded: ReadonlySet<string>;
  userPlatforms: readonly Platform[];
  filters: ParaTiFilters;
  /** Null at cold start (fewer than AFFINITY_MIN_RATED rated watches). */
  scorer: AffinityScorer | null;
  /** Stable within a day: user id + date. */
  seed: string;
  limit?: number;
};

export const PARA_TI_LIMIT = 40;

/** FNV-1a of a string, as a number in [0, 1). */
export const unitHash = (value: string) => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) / 0x1_0000_0000;
};

/** Daily seed: the same order all day for a person, a slightly different one tomorrow. */
export const dailySeed = (userId: string, now: Date) =>
  `${userId}:${now.toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" })}`;

/**
 * Quality on 0–1: IMDb when OMDb has a solid read, else TMDB's average shrunk toward 6.6 by
 * its votes (300 votes weigh as much as the prior), mapped 5.5 → 0 and 9 → 1.
 */
export const qualityOf = (candidate: Pick<ParaTiCandidate, "imdbRating" | "imdbVotes" | "voteAverage" | "voteCount">) => {
  const prior = 6.6;
  let value: number | null = null;
  if (candidate.imdbRating != null && (candidate.imdbVotes ?? 0) >= 1000) {
    value = candidate.imdbRating;
  } else if (candidate.voteAverage != null) {
    const votes = Math.max(0, candidate.voteCount);
    value = (candidate.voteAverage * votes + prior * 300) / (votes + 300);
  }
  if (value == null) return 0.3;
  return Math.min(1, Math.max(0, (value - 5.5) / 3.5));
};

const eraOf = (id: EraId | null) => (id ? ERAS.find((era) => era.id === id) ?? null : null);

/** Whether a candidate passes the kind, era, runtime and platform filters. */
export const passesFilters = (
  candidate: ParaTiCandidate,
  filters: ParaTiFilters,
  userPlatforms: readonly Platform[],
) => {
  if (filters.kind && candidate.kind !== filters.kind) return false;
  const era = eraOf(filters.era);
  if (era && (candidate.year == null || candidate.year < era.from || candidate.year > era.to)) return false;
  if (filters.maxRuntime != null && (candidate.runtimeMinutes == null || candidate.runtimeMinutes > filters.maxRuntime)) {
    return false;
  }
  // With no platforms saved the switch cannot apply: everything shows and the page says why.
  if (filters.onlyMine && userPlatforms.length > 0 && !titleAvailableOnUserPlatforms(candidate.providers, userPlatforms)) {
    return false;
  }
  return true;
};

const asTitle = (candidate: ParaTiCandidate) =>
  filmAsTitle({
    id: candidate.catalogId,
    name: candidate.name,
    kind: candidate.kind,
    year: candidate.year,
    imdbRating: candidate.imdbRating,
    imdbVotes: candidate.imdbVotes,
    genres: [...candidate.genres],
    keywords: [...candidate.keywords],
    people: [...candidate.people],
    originalLanguage: candidate.originalLanguage,
  });

/** One line under the card: the strongest personal reason, else what makes it good. */
const qualityReason = (candidate: ParaTiCandidate) => {
  if (candidate.imdbRating != null) return `IMDb ${candidate.imdbRating.toFixed(1)}`;
  if (candidate.rtScore != null) return `${candidate.rtScore}% en Rotten Tomatoes`;
  if (candidate.voteAverage != null && candidate.voteCount >= 50) {
    return `${candidate.voteAverage.toFixed(1)} en TMDB`;
  }
  return null;
};

export const toParaTiTitle = (
  candidate: ParaTiCandidate,
  userPlatforms: readonly Platform[],
  scorer: AffinityScorer | null,
): ParaTiTitle => {
  let affinity: ParaTiAffinity | null = null;
  let reason: string | null = null;
  const hasFeatures = candidate.genres.length + candidate.keywords.length + candidate.people.length > 0;
  if (scorer && hasFeatures) {
    const result = affinityFor(scorer, asTitle(candidate));
    affinity = { level: result.level, label: result.label, lowConfidence: result.lowConfidence };
    reason = result.reasons.find((item) => item.personal)?.text ?? null;
  }
  return {
    catalogId: candidate.catalogId,
    tmdbId: candidate.tmdbId,
    kind: candidate.kind,
    name: candidate.name,
    year: candidate.year,
    posterPath: candidate.posterPath,
    posterAmbient: candidate.posterAmbient,
    runtimeMinutes: candidate.runtimeMinutes,
    imdbRating: candidate.imdbRating,
    rtScore: candidate.rtScore,
    platform: primaryAvailabilityPlatform(candidate.providers?.flatrate, null, userPlatforms),
    affinity,
    reason: reason ?? qualityReason(candidate),
  };
};

/** Score for the order: taste and quality with a scorer, quality alone without; a small pool prior and daily jitter. */
export const scoreCandidate = (candidate: ParaTiCandidate, scorer: AffinityScorer | null, seed: string) => {
  const quality = qualityOf(candidate);
  const prior = 1 - Math.min(1, candidate.poolRank / 100);
  const jitter = (unitHash(`${seed}:${candidate.catalogId}`) - 0.5) * 0.06;
  const hasFeatures = candidate.genres.length + candidate.keywords.length + candidate.people.length > 0;
  if (scorer && hasFeatures) {
    const taste = affinityScore(scorer, asTitle(candidate)).normalized;
    return 0.6 * taste + 0.3 * quality + 0.1 * prior + jitter;
  }
  return 0.8 * quality + 0.2 * prior + jitter;
};

/** Unique by catalog id, keeping the best pool rank. */
export const dedupeCandidates = (candidates: readonly ParaTiCandidate[]) => {
  const best = new Map<string, ParaTiCandidate>();
  for (const candidate of candidates) {
    const known = best.get(candidate.catalogId);
    if (!known || candidate.poolRank < known.poolRank) best.set(candidate.catalogId, candidate);
  }
  return [...best.values()];
};

/** The ranked titles of a pool for one person. */
export const rankParaTi = (candidates: readonly ParaTiCandidate[], context: RankContext): ParaTiTitle[] => {
  const limit = context.limit ?? PARA_TI_LIMIT;
  return dedupeCandidates(candidates)
    .filter((candidate) => candidate.posterPath && !context.excluded.has(candidate.catalogId))
    .filter((candidate) => passesFilters(candidate, context.filters, context.userPlatforms))
    .map((candidate) => ({ candidate, score: scoreCandidate(candidate, context.scorer, context.seed) }))
    .sort((a, b) => b.score - a.score || a.candidate.catalogId.localeCompare(b.candidate.catalogId))
    .slice(0, limit)
    .map(({ candidate }) => toParaTiTitle(candidate, context.userPlatforms, context.scorer));
};

/** Candidates ordered by likeness to one title (the anchor of «Porque te gustó…»). */
export const rankByLikeness = (
  candidates: readonly ParaTiCandidate[],
  anchor: FeatureVector,
  related: ReadonlySet<number>,
  context: RankContext,
): ParaTiTitle[] => {
  const limit = context.limit ?? PARA_TI_LIMIT;
  return dedupeCandidates(candidates)
    .filter((candidate) => candidate.posterPath && !context.excluded.has(candidate.catalogId))
    .filter((candidate) => passesFilters(candidate, context.filters, context.userPlatforms))
    .map((candidate) => {
      const likeness = cosine(anchor, itemVector(asTitle(candidate)));
      // TMDB's own «recommendations» for the anchor lead; content likeness orders the rest.
      const score = likeness + (related.has(candidate.tmdbId) ? 1 : 0) + 0.15 * qualityOf(candidate);
      return { candidate, score };
    })
    .filter(({ candidate, score }) => related.has(candidate.tmdbId) || score > 0.2)
    .sort((a, b) => b.score - a.score || a.candidate.catalogId.localeCompare(b.candidate.catalogId))
    .slice(0, limit)
    .map(({ candidate }) => toParaTiTitle(candidate, context.userPlatforms, context.scorer));
};

// ── URL state ────────────────────────────────────────────────────────────────────────

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** Filters from `?tipo=pelicula|serie&epoca=2010s&duracion=90&todas=1`. */
export const parseFilters = (params: Record<string, string | string[] | undefined>): ParaTiFilters => {
  const tipo = one(params.tipo);
  const era = one(params.epoca);
  const runtime = Number(one(params.duracion));
  return {
    kind: tipo === "pelicula" ? "MOVIE" : tipo === "serie" ? "SERIES" : null,
    era: ERAS.some((item) => item.id === era) ? (era as EraId) : null,
    maxRuntime: (RUNTIMES as readonly number[]).includes(runtime) ? (runtime as RuntimeCeiling) : null,
    onlyMine: one(params.todas) !== "1",
  };
};

/** The query string of filters (defaults left out), for links and `router.replace`. */
export const filtersToParams = (filters: ParaTiFilters): Record<string, string> => {
  const params: Record<string, string> = {};
  if (filters.kind) params.tipo = filters.kind === "MOVIE" ? "pelicula" : "serie";
  if (filters.era) params.epoca = filters.era;
  if (filters.maxRuntime) params.duracion = String(filters.maxRuntime);
  if (!filters.onlyMine) params.todas = "1";
  return params;
};
