import { catalogIdFor } from "@/lib/catalog-core";
import { FAVORITAS_SLUG } from "@/lib/lists";
import type {
  RecoCandidate,
  RecoSeed,
  RecoSourceKind,
  TonightEvent,
  TonightQueueEntry,
  TonightTitle,
} from "@/lib/tonight/types";
import type { TitleKind } from "@/db";
import { daysBetween } from "@/lib/tonight/time";

/**
 * Candidate generation for Hoy's recommendations (FIL-I6-2). Pure: the TMDB calls live in
 * `reco-store.ts`. Parameters come from the offline evaluation (FIL-I6-1): many seeds beat
 * few, `/similar` found nothing, and scoring fewer than ~200 candidates loses real hits.
 */

export const SEED_QUEUE_CAP = 12;
export const SEED_LIKED_CAP = 40;
export const SEED_LIKED_MIN_RATING = 7;
export const GENRE_POOLS = 3;
export const DISCOVER_MIN_VOTES = 200;
/** Candidates with fewer votes are noise. */
export const CANDIDATE_MIN_VOTES = 100;
export const SCORE_CAP = 300;
/** A kind gets its own discover pools once it has this many seeds. */
export const DISCOVER_KIND_MIN_SEEDS = 3;
export const RECO_NOT_TONIGHT_DAYS = 14;

/** What a library title needs to become a seed: its TMDB identity. */
export type LibraryRef = { tmdbId: number; catalogId: string };

export const candidateKey = (kind: TitleKind, tmdbId: number) => `${kind}:${tmdbId}`;

/** A film as TMDB lists it (`TmdbDiscoverResult` fits). */
export type ListedTitle = {
  tmdbId: number;
  kind: TitleKind;
  name: string;
  originalName: string | null;
  year: number | null;
  posterPath: string | null;
  backdropPath: string | null;
  overview: string | null;
  voteAverage: number | null;
  voteCount: number;
  genreIds: number[];
};

/**
 * Seeds: the first of Quiero ver by position, then the films you liked (rated ≥7 or in
 * Favoritas) by rating and recency. Dropped series never seed. A seed needs its TMDB id.
 */
export const pickSeeds = (input: {
  titles: readonly TonightTitle[];
  queue: readonly TonightQueueEntry[];
  refs: ReadonlyMap<string, LibraryRef>;
}): RecoSeed[] => {
  const byId = new Map(input.titles.map((title) => [title.id, title]));
  const seeds: RecoSeed[] = [];
  const seen = new Set<string>();

  const push = (title: TonightTitle, via: RecoSeed["via"]) => {
    const ref = input.refs.get(title.id);
    if (!ref || seen.has(title.id)) {
      return;
    }
    seen.add(title.id);
    seeds.push({
      titleId: title.id,
      catalogId: ref.catalogId,
      tmdbId: ref.tmdbId,
      kind: title.kind,
      name: title.name,
      via,
      rating: title.rating,
    });
  };

  [...input.queue]
    .sort((a, b) => a.position - b.position)
    .map((entry) => byId.get(entry.titleId))
    .filter((title): title is TonightTitle => Boolean(title) && title!.watchedAt == null)
    .slice(0, SEED_QUEUE_CAP)
    .forEach((title) => push(title, "queue"));

  input.titles
    .filter(
      (title) =>
        title.watchedAt != null &&
        !(title.kind === "SERIES" && title.seriesStatus === "DROPPED") &&
        ((title.rating ?? 0) >= SEED_LIKED_MIN_RATING || title.listSlugs.includes(FAVORITAS_SLUG)),
    )
    .sort(
      (a, b) =>
        (b.rating ?? 0) - (a.rating ?? 0) ||
        (b.watchedAt?.getTime() ?? 0) - (a.watchedAt?.getTime() ?? 0),
    )
    .slice(0, SEED_LIKED_CAP)
    .forEach((title) => push(title, "watched"));

  return seeds;
};

/** Kinds worth a discover pool: those with enough seeds, else the most common one. */
export const discoverKinds = (seeds: readonly RecoSeed[]): TitleKind[] => {
  const counts = new Map<TitleKind, number>();
  for (const seed of seeds) {
    counts.set(seed.kind, (counts.get(seed.kind) ?? 0) + 1);
  }
  const enough = [...counts.entries()]
    .filter(([, count]) => count >= DISCOVER_KIND_MIN_SEEDS)
    .map(([kind]) => kind);
  if (enough.length > 0) {
    return enough;
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  return [top ?? "MOVIE"];
};

/** The genres the profile (with Quiero ver) leans on most. */
export const topGenreIds = (genreAffinity: ReadonlyMap<number, number>, count = GENRE_POOLS) =>
  [...genreAffinity.entries()]
    .filter(([, weight]) => weight > 0)
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .slice(0, count)
    .map(([id]) => id);

export type CandidateBatch = {
  items: readonly ListedTitle[];
  sourceKind: RecoSourceKind;
  seed: RecoSeed | null;
};

/** One entry per film; it remembers every source that proposed it. */
export const mergeCandidates = (batches: readonly CandidateBatch[]): Map<string, RecoCandidate> => {
  const merged = new Map<string, RecoCandidate>();
  for (const batch of batches) {
    for (const item of batch.items) {
      const key = candidateKey(item.kind, item.tmdbId);
      const source = { kind: batch.sourceKind, seed: batch.seed };
      const current = merged.get(key);
      if (current) {
        const duplicate = current.sources.some(
          (existing) =>
            existing.kind === source.kind && existing.seed?.titleId === source.seed?.titleId,
        );
        if (!duplicate) {
          current.sources.push(source);
        }
        continue;
      }
      merged.set(key, {
        key,
        catalogId: catalogIdFor(item.kind, item.tmdbId),
        tmdbId: item.tmdbId,
        kind: item.kind,
        name: item.name,
        originalName: item.originalName,
        year: item.year,
        posterPath: item.posterPath,
        backdropPath: item.backdropPath,
        overview: item.overview,
        voteAverage: item.voteAverage,
        voteCount: item.voteCount,
        genreIds: item.genreIds,
        sources: [source],
      });
    }
  }
  return merged;
};

/**
 * Film ids the user does not want to see recommended: «Menos así» for as long as the engine
 * remembers it, and «Ahora no» for two weeks. Ids are the engine's (`Title` id if owned, else
 * the catalog id), which for a film outside the library is its catalog id.
 */
export const blockedItemIds = (events: readonly TonightEvent[], now: Date): Set<string> => {
  const blocked = new Set<string>();
  for (const event of events) {
    if (event.kind === "less_like") {
      blocked.add(event.titleId);
    } else if (
      event.kind === "not_tonight" &&
      daysBetween(event.createdAt, now) < RECO_NOT_TONIGHT_DAYS
    ) {
      blocked.add(event.titleId);
    }
  }
  return blocked;
};

/** Drop everything already in the library (any status) and everything the user pushed away. */
export const excludeCandidates = (
  candidates: ReadonlyMap<string, RecoCandidate>,
  options: { libraryKeys: ReadonlySet<string>; blockedIds: ReadonlySet<string> },
): Map<string, RecoCandidate> => {
  const kept = new Map<string, RecoCandidate>();
  for (const [key, candidate] of candidates) {
    if (options.libraryKeys.has(key) || options.blockedIds.has(candidate.catalogId)) {
      continue;
    }
    kept.set(key, candidate);
  }
  return kept;
};

/**
 * Cheap pre-ranking from the list payload alone, so the expensive details call only runs on
 * the best `cap`: mean genre affinity (0–1 of the user's strongest genre), a bonus per
 * source that proposed it, and TMDB's average as a quality nudge.
 */
export const cheapScore = (
  candidate: RecoCandidate,
  genreAffinity: ReadonlyMap<number, number>,
) => {
  const best = Math.max(1e-6, ...genreAffinity.values());
  const genres = candidate.genreIds.map((id) => Math.max(0, genreAffinity.get(id) ?? 0) / best);
  const taste = genres.length > 0 ? genres.reduce((sum, value) => sum + value, 0) / genres.length : 0;
  return taste + 0.2 * candidate.sources.length + 0.03 * (candidate.voteAverage ?? 6);
};

export const prefilterCandidates = (
  candidates: ReadonlyMap<string, RecoCandidate>,
  genreAffinity: ReadonlyMap<number, number>,
  cap = SCORE_CAP,
): RecoCandidate[] =>
  [...candidates.values()]
    .filter((candidate) => candidate.voteCount >= CANDIDATE_MIN_VOTES)
    .map((candidate) => ({ candidate, score: cheapScore(candidate, genreAffinity) }))
    .sort((a, b) => b.score - a.score || b.candidate.voteCount - a.candidate.voteCount)
    .slice(0, cap)
    .map((entry) => entry.candidate);
