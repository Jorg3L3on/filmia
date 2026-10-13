"use server";

import { and, eq, or } from "drizzle-orm";
import { catalog, db } from "@/db";
import { scheduleAfterResponse } from "@/lib/after-response";
import {
  affinityForCatalogRow,
  chipOf,
  loadUserAffinity,
  watchedRatingOf,
} from "@/lib/affinity-store";
import { findCatalogByTmdb, findOrCreateCatalog } from "@/lib/catalog";
import { enrichCatalog } from "@/lib/catalog-enrich";
import { TITLE_KINDS } from "@/lib/labels";
import {
  createEnrichBudget,
  factsFromCatalog,
  PENDING_FACTS,
  pickEnrichmentCandidates,
  SEARCH_FACTS_LOOKUP_LIMIT,
  searchFactsKey,
  type SearchFactsItem,
  type SearchFactsRow,
  type SearchResultFacts,
} from "@/lib/search-result-facts";
import { requireUserId } from "@/lib/session";
import { getTmdbDetails, isTmdbConfigured } from "@/lib/tmdb";

/** 30 enrichments a minute per user, per server instance (OMDb's free tier is ~1,000 a day). */
const takeEnrichBudget = createEnrichBudget(30, 60_000);
/** Films being enriched right now on this instance: a second search never queues them twice. */
const inFlight = new Set<string>();

const isItem = (value: SearchFactsItem) =>
  Number.isSafeInteger(value?.tmdbId) && value.tmdbId > 0 && TITLE_KINDS.includes(value.kind);

const enrichOne = async ({ tmdbId, kind }: SearchFactsItem) => {
  const key = searchFactsKey(kind, tmdbId);
  try {
    let row = await findCatalogByTmdb(tmdbId, kind);
    if (!row) {
      const details = await getTmdbDetails(tmdbId, kind);
      if (!details?.name) {
        return;
      }
      ({ row } = await findOrCreateCatalog({
        tmdbId,
        kind,
        name: details.name,
        originalName: details.originalName,
        year: details.year,
        posterPath: details.posterPath,
      }));
    }
    await enrichCatalog(row);
  } catch {
    // Best-effort: the row shows what it has; the next search or the ficha tries again.
  } finally {
    inFlight.delete(key);
  }
};

/**
 * Buscar row A (FIL-I8-4): IMDb, award, runtime, genre and MX platform for the
 * results, from the shared Catalog in one query. The first few films the
 * Catalog does not know yet are enriched after the response (TMDB + OMDb,
 * both cached a day) and come back `pending`, so the client asks once more.
 */
export const getSearchResultFacts = async (
  items: SearchFactsItem[],
): Promise<Record<string, SearchResultFacts>> => {
  const userId = await requireUserId();
  const wanted = items.filter(isItem).slice(0, SEARCH_FACTS_LOOKUP_LIMIT);
  if (wanted.length === 0) {
    return {};
  }

  // The user's taste (FIL-I9) loads next to the Catalog lookup; it never blocks the IMDb line.
  const [found, user] = await Promise.all([
    db
      .select({
        id: catalog.id,
        tmdbId: catalog.tmdbId,
        kind: catalog.kind,
        name: catalog.name,
        year: catalog.year,
        imdbId: catalog.imdbId,
        imdbRating: catalog.imdbRating,
        imdbVotes: catalog.imdbVotes,
        awards: catalog.awards,
        runtimeMinutes: catalog.runtimeMinutes,
        tmdbGenres: catalog.tmdbGenres,
        tmdbKeywords: catalog.tmdbKeywords,
        tmdbPeople: catalog.tmdbPeople,
        originalLanguage: catalog.originalLanguage,
        watchProvidersMx: catalog.watchProvidersMx,
      })
      .from(catalog)
      .where(or(...wanted.map((item) => and(eq(catalog.tmdbId, item.tmdbId), eq(catalog.kind, item.kind))))),
    loadUserAffinity(userId).catch(() => null),
  ]);
  const rows = new Map<string, SearchFactsRow>(found.map((row) => [searchFactsKey(row.kind, row.tmdbId), row]));

  const facts: Record<string, SearchResultFacts> = {};
  for (const row of found) {
    const base = factsFromCatalog(row);
    facts[searchFactsKey(row.kind, row.tmdbId)] = user
      ? {
          ...base,
          watched: watchedRatingOf(user, row.kind, row.tmdbId),
          affinity: chipOf(affinityForCatalogRow(user, row)),
        }
      : base;
  }

  if (!isTmdbConfigured()) {
    return facts;
  }

  const candidates = pickEnrichmentCandidates(wanted, rows);
  const fresh = candidates.filter((item) => !inFlight.has(searchFactsKey(item.kind, item.tmdbId)));
  const queued = fresh.slice(0, takeEnrichBudget(userId, fresh.length));
  for (const item of candidates) {
    const key = searchFactsKey(item.kind, item.tmdbId);
    if (inFlight.has(key) || queued.includes(item)) {
      facts[key] = { ...(facts[key] ?? PENDING_FACTS), pending: true };
    }
  }
  for (const item of queued) {
    inFlight.add(searchFactsKey(item.kind, item.tmdbId));
  }
  if (queued.length > 0) {
    if (process.env.NODE_ENV === "development") {
      console.info(`[buscar] omdb_calls_per_search=${queued.length}`);
    }
    scheduleAfterResponse(() => Promise.all(queued.map(enrichOne)).then(() => undefined));
  }

  return facts;
};
