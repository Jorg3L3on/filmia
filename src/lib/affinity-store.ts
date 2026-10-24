import { and, count, eq, gte, inArray, max, sql } from "drizzle-orm";
import { cache } from "react";
import { catalog, db, listItems, lists, pickEvents, titles, type TitleKind } from "@/db";
import { parseStoredTmdbGenres } from "@/lib/diary-picks";
import { WATCHLIST_SLUG } from "@/lib/lists";
import {
  parseStoredKeywords,
  parseStoredPeople,
  TONIGHT_EVENTS_WINDOW_DAYS,
} from "@/lib/tonight-store";
import { toTonightEvents } from "@/lib/tonight/events";
import type { TonightTitle } from "@/lib/tonight/types";
import {
  AFFINITY_MIN_RATED,
  affinityFor,
  buildAffinityScorer,
  filmAsTitle,
  type Affinity,
  type AffinityLevel,
  type AffinityScorer,
} from "@/lib/tonight/affinity";

/**
 * FIL-I9-3 · serving «Para ti» (the affinity level). The scorer is per user and never
 * written anywhere (Catalog is shared, FIL-I1): built from the library on demand and kept
 * in memory per server instance while the library does not change.
 */

/** What a Buscar row shows: the chip, no reasons. */
export type AffinityChip = {
  level: AffinityLevel;
  label: string;
  lowConfidence: boolean;
};

export type AffinityReasonView = { text: string; detail: string | null; personId: number | null };

/** What the ficha shows: the chip and the «¿Por qué?» sheet. */
export type AffinityView = AffinityChip & {
  meaning: string;
  reasons: AffinityReasonView[];
};

/**
 * The ficha's state: a prediction, or the cold-start nudge with how many rated watches
 * are missing. A watched film never gets one (the hero shows your rating).
 */
export type FichaAffinity =
  | { kind: "prediction"; affinity: AffinityView; catalogId: string }
  | { kind: "cold"; missing: number };

/**
 * Telemetry (FIL-I9-5): the ficha logs the level it showed as a `PickEvent` of this kind,
 * with `lens` = `afinidad:<level>` (`~` appended at low confidence). Film only (no
 * `titleId`): Hoy never reads this kind and the limbo cleanup keeps ignoring it.
 * `metrics:affinity` compares it later with the rating the user gave.
 */
export const AFFINITY_SHOWN_KIND = "affinity_shown";

export const affinityEventLens = (level: AffinityLevel, lowConfidence: boolean) =>
  `afinidad:${level}${lowConfidence ? "~" : ""}`;

type OwnedEntry = { watched: boolean; rating: number | null };

type UserAffinity = {
  scorer: AffinityScorer | null;
  ratedCount: number;
  owned: ReadonlyMap<string, OwnedEntry>;
};

const ownedKey = (kind: TitleKind, tmdbId: number) => `${kind}:${tmdbId}`;

/** Ten minutes at most: list changes (Favoritas, collections) do not touch the signature. */
const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX_USERS = 50;
const memory = new Map<string, { signature: string; at: number; value: UserAffinity }>();

/** Count and last update of the user's titles: a rating, a watch or a removal changes it. */
const librarySignature = async (userId: string) => {
  const [row] = await db
    .select({ n: count(), last: max(titles.updatedAt) })
    .from(titles)
    .where(eq(titles.userId, userId));
  return `${row?.n ?? 0}:${row?.last?.getTime() ?? 0}`;
};

/**
 * The library as the profile reads it, and nothing else: three narrow queries in parallel
 * (titles × catalog features, list memberships, Más/Menos así). Hoy's `loadTonightInput`
 * also reads providers, overviews and prefs, which the profile never uses.
 */
export const loadAffinityLibrary = async (userId: string, now: Date) => {
  const since = new Date(now.getTime() - TONIGHT_EVENTS_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const [rows, memberships, events] = await Promise.all([
    db
      .select({
        id: titles.id,
        catalogId: titles.catalogId,
        // ¿Las viste? answers count for Afinidad like stars (FIL-I26).
        rating: sql<number | null>`coalesce(${titles.rating}, ${titles.impliedRating})`,
        watchedAt: titles.watchedAt,
        seriesStatus: titles.seriesStatus,
        createdAt: titles.createdAt,
        tmdbId: catalog.tmdbId,
        kind: catalog.kind,
        name: catalog.name,
        year: catalog.year,
        imdbRating: catalog.imdbRating,
        imdbVotes: catalog.imdbVotes,
        tmdbGenres: catalog.tmdbGenres,
        tmdbKeywords: catalog.tmdbKeywords,
        tmdbPeople: catalog.tmdbPeople,
        originalLanguage: catalog.originalLanguage,
      })
      .from(titles)
      .innerJoin(catalog, eq(catalog.id, titles.catalogId))
      .where(eq(titles.userId, userId)),
    db
      .select({ titleId: titles.id, listId: lists.id, slug: lists.slug })
      .from(listItems)
      .innerJoin(lists, eq(lists.id, listItems.listId))
      .innerJoin(titles, and(eq(titles.catalogId, listItems.catalogId), eq(titles.userId, userId)))
      .where(eq(lists.userId, userId)),
    db
      .select({
        titleId: pickEvents.titleId,
        catalogId: pickEvents.catalogId,
        kind: pickEvents.kind,
        createdAt: pickEvents.createdAt,
      })
      .from(pickEvents)
      .where(
        and(
          eq(pickEvents.userId, userId),
          gte(pickEvents.createdAt, since),
          inArray(pickEvents.kind, ["more_like", "less_like"]),
        ),
      ),
  ]);

  const slugsByTitle = new Map<string, string[]>();
  for (const membership of memberships) {
    const slug = membership.slug ?? membership.listId;
    if (slug === WATCHLIST_SLUG) {
      continue;
    }
    const bucket = slugsByTitle.get(membership.titleId);
    if (bucket) {
      bucket.push(slug);
    } else {
      slugsByTitle.set(membership.titleId, [slug]);
    }
  }

  const library: TonightTitle[] = rows.map((row) => ({
    id: row.id,
    name: row.name,
    kind: row.kind,
    year: row.year,
    runtimeMinutes: null,
    imdbRating: row.imdbRating,
    imdbVotes: row.imdbVotes,
    genres: parseStoredTmdbGenres(row.tmdbGenres),
    keywords: parseStoredKeywords(row.tmdbKeywords),
    people: parseStoredPeople(row.tmdbPeople),
    originalLanguage: row.originalLanguage,
    platform: null,
    flatrate: [],
    availableOnMine: false,
    watchedAt: row.watchedAt,
    rating: row.rating,
    review: null,
    seriesStatus: row.seriesStatus,
    seriesSeason: null,
    listSlugs: slugsByTitle.get(row.id) ?? [],
    availableSince: null,
    createdAt: row.createdAt,
  }));
  const ownedByCatalog = new Map(rows.map((row) => [row.catalogId, row.id]));
  return { rows, library, events: toTonightEvents(events, ownedByCatalog) };
};

const buildUserAffinity = async (userId: string, now: Date): Promise<UserAffinity> => {
  const { rows, library, events } = await loadAffinityLibrary(userId, now);
  const scorer = buildAffinityScorer(library, events, now);
  const owned = new Map<string, OwnedEntry>();
  rows.forEach((row) => {
    owned.set(ownedKey(row.kind, row.tmdbId), { watched: row.watchedAt != null, rating: row.rating });
  });
  const ratedCount = library.filter((t) => t.watchedAt != null && t.rating != null).length;
  return { scorer, ratedCount, owned };
};

/**
 * The user's scorer, memoized per request (React `cache`) and per instance (signature +
 * TTL). Logs `affinity_profile_ms` in development.
 */
export const loadUserAffinity = cache(async (userId: string): Promise<UserAffinity> => {
  const started = performance.now();
  const signature = await librarySignature(userId);
  const hit = memory.get(userId);
  if (hit && hit.signature === signature && Date.now() - hit.at < CACHE_TTL_MS) {
    return hit.value;
  }
  const value = await buildUserAffinity(userId, new Date());
  memory.delete(userId);
  memory.set(userId, { signature, at: Date.now(), value });
  while (memory.size > CACHE_MAX_USERS) {
    memory.delete(memory.keys().next().value!);
  }
  if (process.env.NODE_ENV === "development") {
    console.info(`[afinidad] affinity_profile_ms=${Math.round(performance.now() - started)}`);
  }
  return value;
});

/** Forget a user's scorer (after a write on this instance; other instances wait for the TTL). */
export const forgetUserAffinity = (userId: string) => {
  memory.delete(userId);
};

/** The Catalog columns a prediction reads. */
export type AffinityCatalogRow = {
  id: string;
  tmdbId: number;
  kind: TitleKind;
  name: string;
  year: number | null;
  imdbRating: number | null;
  imdbVotes: number | null;
  tmdbGenres: unknown;
  tmdbKeywords: unknown;
  tmdbPeople: unknown;
  originalLanguage: string | null;
};

const toView = (affinity: Affinity): AffinityView => ({
  level: affinity.level,
  label: affinity.label,
  lowConfidence: affinity.lowConfidence,
  meaning: affinity.meaning,
  reasons: affinity.reasons.map((reason) => ({
    text: reason.text,
    detail: reason.detail ?? null,
    personId: reason.personId ?? null,
  })),
});

/** A prediction for a Catalog film, or null (cold start, already watched, nothing to go on). */
export const affinityForCatalogRow = (
  user: UserAffinity,
  row: AffinityCatalogRow,
): AffinityView | null => {
  if (!user.scorer || user.owned.get(ownedKey(row.kind, row.tmdbId))?.watched) {
    return null;
  }
  const genres = parseStoredTmdbGenres(row.tmdbGenres);
  const keywords = parseStoredKeywords(row.tmdbKeywords);
  const people = parseStoredPeople(row.tmdbPeople);
  if (genres.length === 0 && keywords.length === 0 && people.length === 0) {
    return null;
  }
  const title = filmAsTitle({
    id: row.id,
    name: row.name,
    kind: row.kind,
    year: row.year,
    imdbRating: row.imdbRating,
    imdbVotes: row.imdbVotes,
    genres,
    keywords,
    people,
    originalLanguage: row.originalLanguage,
  });
  return toView(affinityFor(user.scorer, title));
};

export const chipOf = (view: AffinityView | null): AffinityChip | null =>
  view ? { level: view.level, label: view.label, lowConfidence: view.lowConfidence } : null;

/** The ficha's affinity for a film the user has not watched (owned or not). */
export const fichaAffinity = async (
  userId: string,
  row: AffinityCatalogRow,
): Promise<FichaAffinity | null> => {
  const user = await loadUserAffinity(userId);
  if (user.owned.get(ownedKey(row.kind, row.tmdbId))?.watched) {
    return null;
  }
  if (!user.scorer) {
    return { kind: "cold", missing: Math.max(1, AFFINITY_MIN_RATED - user.ratedCount) };
  }
  const affinity = affinityForCatalogRow(user, row);
  return affinity ? { kind: "prediction", affinity, catalogId: row.id } : null;
};

/** The user's rating of a film they watched, for Buscar rows («vistas muestran tu nota»). */
export const watchedRatingOf = (user: UserAffinity, kind: TitleKind, tmdbId: number) => {
  const entry = user.owned.get(ownedKey(kind, tmdbId));
  return entry?.watched ? { rating: entry.rating } : null;
};
