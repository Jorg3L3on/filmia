import type { TitleKind } from "@/db";
import { awardChipLabel } from "@/lib/awards";
import { parseStoredTmdbGenres } from "@/lib/diary-picks";
import { catalogNeedsEnrichment } from "@/lib/title-preview";
import { parseStoredWatchProviders } from "@/lib/watch-providers";

/**
 * What a Buscar row adds to TMDB's search snapshot (row A, FIL-I8-4): read
 * from the shared Catalog, so a film anybody saved shows its IMDb at once.
 * `pending` = the Catalog is filling it right now (the row holds the space).
 */
export type SearchResultFacts = {
  imdbRating: number | null;
  awardLabel: string | null;
  runtimeMinutes: number | null;
  genre: string | null;
  platform: string | null;
  pending: boolean;
};

export type SearchFactsItem = { tmdbId: number; kind: TitleKind };

export const searchFactsKey = (kind: TitleKind, tmdbId: number) => `${kind}:${tmdbId}`;

/** The Catalog columns the facts read. */
export type SearchFactsRow = SearchFactsItem & {
  imdbId: string | null;
  imdbRating: number | null;
  awards: string | null;
  runtimeMinutes: number | null;
  tmdbGenres: unknown;
  watchProvidersMx: unknown;
};

/** Most a search asks the Catalog about; most it enriches (one OMDb call each). */
export const SEARCH_FACTS_LOOKUP_LIMIT = 24;
export const SEARCH_FACTS_ENRICH_LIMIT = 6;

export const PENDING_FACTS: SearchResultFacts = {
  imdbRating: null,
  awardLabel: null,
  runtimeMinutes: null,
  genre: null,
  platform: null,
  pending: true,
};

/**
 * The subscription to name: a service before an «… Amazon Channel» add-on
 * (TMDB lists both), and the add-on by its own name when it is all there is.
 */
export const pickPlatformName = (watchProvidersMx: unknown): string | null => {
  const flatrate = parseStoredWatchProviders(watchProvidersMx)?.flatrate ?? [];
  const service = flatrate.find((offer) => !/channel/i.test(offer.name)) ?? flatrate[0];
  return service ? service.name.replace(/\s+Amazon Channel$/i, "").trim() || service.name : null;
};

/** The row's line from a Catalog row: IMDb, award chip, runtime, first genre, first MX subscription. */
export const factsFromCatalog = (row: SearchFactsRow): SearchResultFacts => ({
  imdbRating: row.imdbRating ?? null,
  awardLabel: awardChipLabel(row.awards),
  runtimeMinutes: row.runtimeMinutes ?? null,
  genre: parseStoredTmdbGenres(row.tmdbGenres)[0]?.name ?? null,
  platform: pickPlatformName(row.watchProvidersMx),
  pending: false,
});

/**
 * Which results get enriched now: in search order, those without a Catalog
 * row or only a snapshot of one, once each, at most `limit`. A film that
 * already went through OMDb and has no rating (a new release) is not retried.
 */
export const pickEnrichmentCandidates = (
  items: readonly SearchFactsItem[],
  rows: ReadonlyMap<string, SearchFactsRow>,
  limit = SEARCH_FACTS_ENRICH_LIMIT,
): SearchFactsItem[] => {
  const seen = new Set<string>();
  const picked: SearchFactsItem[] = [];
  for (const item of items) {
    const key = searchFactsKey(item.kind, item.tmdbId);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    const row = rows.get(key);
    if (!row || catalogNeedsEnrichment(row)) {
      picked.push(item);
      if (picked.length >= limit) {
        break;
      }
    }
  }
  return picked;
};

/**
 * Sliding-window budget per user (in memory, per server instance): keeps a
 * fast typist or a stuck client from spending the day's OMDb calls.
 */
export const createEnrichBudget = (perWindow: number, windowMs: number) => {
  const spent = new Map<string, number[]>();
  return (userId: string, wanted: number, now = Date.now()) => {
    const recent = (spent.get(userId) ?? []).filter((at) => now - at < windowMs);
    const granted = Math.max(0, Math.min(wanted, perWindow - recent.length));
    spent.set(userId, [...recent, ...Array.from({ length: granted }, () => now)]);
    return granted;
  };
};
