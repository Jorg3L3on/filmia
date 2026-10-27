"use server";

import { and, eq, or } from "drizzle-orm";
import { catalog, db, users } from "@/db";
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
  FILMOGRAPHY_FACTS_LIMIT,
  PENDING_FACTS,
  pickEnrichmentCandidates,
  pickProviderCandidates,
  SEARCH_FACTS_LOOKUP_LIMIT,
  searchFactsKey,
  type SearchFactsItem,
  type SearchFactsRow,
  type SearchResultFacts,
} from "@/lib/search-result-facts";
import { runPool } from "@/lib/run-pool";
import { requireUserId } from "@/lib/session";
import { mineAvailability, parseStoredStreamingPlatforms } from "@/lib/streaming-platforms";
import { getTmdbDetails, getTmdbPersonFilmography, isTmdbConfigured } from "@/lib/tmdb";
import { isPersonRole, type PersonRole } from "@/lib/person-filmography";
import { refreshWatchProvidersMx } from "@/lib/watch-providers-cache";

/** 30 enrichments a minute per user, per server instance (OMDb's free tier is ~1,000 a day). */
const takeEnrichBudget = createEnrichBudget(30, 60_000);
/** Films being enriched right now on this instance: a second search never queues them twice. */
const inFlight = new Set<string>();
/** MX availability (FIL-I30-1): TMDB only, so a wider budget; a big filmography is ~90 calls once. */
const takeProvidersBudget = createEnrichBudget(300, 60_000);
const providersInFlight = new Set<string>();
const PROVIDERS_CONCURRENCY = 16;

const isItem = (value: SearchFactsItem) =>
  Number.isSafeInteger(value?.tmdbId) && value.tmdbId > 0 && TITLE_KINDS.includes(value.kind);

type CatalogSeed = Parameters<typeof findOrCreateCatalog>[0];

/**
 * The film's Catalog row, created from TMDB's own data, never from what the
 * client sent: the person's credits when we have them (cached, one call for the
 * whole work), else the film's details.
 */
const catalogRowFor = async ({ tmdbId, kind }: SearchFactsItem, seed?: CatalogSeed) => {
  const row = await findCatalogByTmdb(tmdbId, kind);
  if (row) {
    return row;
  }
  const details = seed ?? (await getTmdbDetails(tmdbId, kind));
  if (!details?.name) {
    return null;
  }
  const created = await findOrCreateCatalog({
    tmdbId,
    kind,
    name: details.name,
    originalName: details.originalName,
    year: details.year,
    posterPath: details.posterPath,
  });
  return created.row;
};

/** Seeds for a person's whole work, from the cached `combined_credits` the view was built from. */
const personSeeds = async (person: { id: number; role: PersonRole } | undefined) => {
  const seeds = new Map<string, CatalogSeed>();
  if (!person || !Number.isSafeInteger(person.id) || person.id <= 0 || !isPersonRole(person.role)) {
    return seeds;
  }
  try {
    const work = await getTmdbPersonFilmography(person.id, person.role);
    for (const entry of [...work.entries, ...work.upcoming, ...work.others]) {
      seeds.set(searchFactsKey(entry.kind, entry.tmdbId), {
        tmdbId: entry.tmdbId,
        kind: entry.kind,
        name: entry.name,
        originalName: entry.originalName,
        year: entry.year,
        posterPath: entry.posterPath,
      });
    }
  } catch {
    // Without seeds, each film falls back to its own details.
  }
  return seeds;
};

const enrichOne = async (item: SearchFactsItem) => {
  const key = searchFactsKey(item.kind, item.tmdbId);
  try {
    const row = await catalogRowFor(item);
    if (!row) {
      return;
    }
    await enrichCatalog(row);
  } catch {
    // Best-effort: the row shows what it has; the next search or the ficha tries again.
  } finally {
    inFlight.delete(key);
  }
};

const fetchProvidersOne = async (item: SearchFactsItem, seed?: CatalogSeed) => {
  try {
    const row = await catalogRowFor(item, seed);
    if (row) {
      await refreshWatchProvidersMx(row.id, item.tmdbId, item.kind);
    }
  } catch {
    // Unknown availability stays unknown; the next visit tries again.
  } finally {
    providersInFlight.delete(searchFactsKey(item.kind, item.tmdbId));
  }
};

/**
 * Row A's facts for up to `limit` titles, from the shared Catalog in one query.
 * The first few films the Catalog does not know yet (in the order given) are
 * enriched after the response (TMDB + OMDb, both cached a day) and come back
 * `pending`, so the client asks once more.
 */
const lookupFacts = async (
  items: SearchFactsItem[],
  limit: number,
  { providers = false, person }: { providers?: boolean; person?: { id: number; role: PersonRole } } = {},
): Promise<Record<string, SearchResultFacts>> => {
  const userId = await requireUserId();
  const wanted = items.filter(isItem).slice(0, limit);
  if (wanted.length === 0) {
    return {};
  }

  // The user's taste (FIL-I9) loads next to the Catalog lookup; it never blocks the IMDb line.
  const [found, user, platforms] = await Promise.all([
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
    db.query.users
      .findFirst({ where: eq(users.id, userId), columns: { streamingPlatforms: true } })
      .then((row) => parseStoredStreamingPlatforms(row?.streamingPlatforms))
      .catch(() => []),
  ]);
  const rows = new Map<string, SearchFactsRow>(found.map((row) => [searchFactsKey(row.kind, row.tmdbId), row]));

  const facts: Record<string, SearchResultFacts> = {};
  for (const row of found) {
    const base = { ...factsFromCatalog(row), ...mineAvailability(row.watchProvidersMx, platforms) };
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

  if (providers && platforms.length > 0) {
    // «En mis plataformas» (FIL-I30-1): a film never checked against TMDB asks for its MX
    // availability after the response; one going through OMDb above gets it there too.
    const enriching = (key: string) => inFlight.has(key);
    const missing = pickProviderCandidates(wanted, rows);
    const fetchable = missing.filter((item) => {
      const key = searchFactsKey(item.kind, item.tmdbId);
      return !enriching(key) && !providersInFlight.has(key);
    });
    const fetching = fetchable.slice(0, takeProvidersBudget(userId, fetchable.length));
    for (const item of fetching) {
      providersInFlight.add(searchFactsKey(item.kind, item.tmdbId));
    }
    for (const item of missing) {
      const key = searchFactsKey(item.kind, item.tmdbId);
      if (enriching(key) || providersInFlight.has(key)) {
        facts[key] = { ...(facts[key] ?? { ...PENDING_FACTS, pending: false }), providersPending: true };
      }
    }
    if (fetching.length > 0) {
      if (process.env.NODE_ENV === "development") {
        console.info(`[buscar] tmdb_provider_calls_per_person=${fetching.length}`);
      }
      scheduleAfterResponse(async () => {
        const seeds = await personSeeds(person);
        await runPool(fetching, PROVIDERS_CONCURRENCY, (item) =>
          fetchProvidersOne(item, seeds.get(searchFactsKey(item.kind, item.tmdbId))),
        );
      });
    }
  }

  return facts;
};

/** Buscar row A (FIL-I8-4): IMDb, award, runtime, genre and MX platform for the results. */
export const getSearchResultFacts = async (items: SearchFactsItem[]) =>
  lookupFacts(items, SEARCH_FACTS_LOOKUP_LIMIT);

/**
 * A person's filmography (FIL-I16-1): the whole work at once, because «Lo
 * esencial» and «Podría gustarte» rank all of it. OMDb stays gradual: the same
 * per-call and per-user budget as Buscar, best-known titles first (the client's order).
 * It also fetches the MX availability nobody checked yet, for «En mis plataformas» (FIL-I30).
 */
export const getFilmographyFacts = async (items: SearchFactsItem[], person?: { id: number; role: PersonRole }) =>
  lookupFacts(items, FILMOGRAPHY_FACTS_LIMIT, { providers: true, person });
