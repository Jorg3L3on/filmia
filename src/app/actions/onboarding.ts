"use server";

import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { catalog, db, listItems, lists, titles, users, type TitleKind } from "@/db";
import { refreshSessionUser } from "@/lib/auth";
import { upsertTitleFromTmdbForUser } from "@/lib/add-title-from-tmdb";
import { ensureDefaultLists, FAVORITAS_SLUG, WATCHLIST_SLUG } from "@/lib/lists";
import { resolveTitleMetadata } from "@/lib/metadata";
import { isOnboardingStepId, type OnboardingStepId } from "@/lib/onboarding/steps";
import { getOnboardingLibrary, getPlatformSuggestions, type SuggestionItem } from "@/lib/onboarding/load";
import { payoffEmptyKind, pickPayoffCard, type PayoffPayload } from "@/lib/onboarding/payoff";
import type { YearPickState } from "@/lib/onboarding/year-grid";
import { formatAmbientRgb } from "@/lib/poster-ambient";
import { sampleAmbientFromPosterPath } from "@/lib/poster-ambient-server";
import {
  revalidateListMembership,
  revalidateProfileSurfaces,
  revalidateRatingSurfaces,
  revalidateWatchlistSurfaces,
} from "@/lib/revalidate-surfaces";
import { runPool } from "@/lib/run-pool";
import { requireUserId } from "@/lib/session";
import { parseStoredStreamingPlatforms } from "@/lib/streaming-platforms";
import { computeTonightForUser, getTonightDecks, scheduleTonightRecompute } from "@/lib/tonight-store";
import { parseStoredWatchProviders } from "@/lib/watch-providers";
import { refreshWatchProvidersMx } from "@/lib/watch-providers-cache";
import { withTimeout } from "@/lib/with-timeout";

export type TmdbPickInput = {
  tmdbId: number;
  kind: TitleKind;
  name: string;
  originalName?: string | null;
  year?: number | null;
  posterPath?: string | null;
};

export type PickResult =
  | { ok: true; titleId: string; created: boolean; ambient: string | null }
  | { ok: false; error: string };

const FAVORITE_RATING = 10;
const PAYOFF_ENRICH_TIMEOUT_MS = 4000;

/** Resume pointer. Only while gated: a rerun from Perfil never rewrites it. */
export const saveOnboardingStep = async (step: OnboardingStepId) => {
  if (!isOnboardingStepId(step)) {
    return;
  }
  const userId = await requireUserId();
  await db
    .update(users)
    .set({ onboardingStep: step })
    .where(and(eq(users.id, userId), isNull(users.onboardedAt)));
};

const fixedListId = async (userId: string, slug: typeof FAVORITAS_SLUG | typeof WATCHLIST_SLUG) => {
  const fixed = await ensureDefaultLists(userId);
  return fixed.find((list) => list.slug === slug)?.id ?? null;
};

const appendToList = async (listId: string, titleId: string) => {
  const last = await db.query.listItems.findFirst({
    where: eq(listItems.listId, listId),
    orderBy: [desc(listItems.position)],
    columns: { position: true },
  });
  await db
    .insert(listItems)
    .values({ listId, titleId, position: (last?.position ?? -1) + 1 })
    .onConflictDoNothing();
};

const deleteOwnedTitle = async (userId: string, titleId: string) => {
  await db.delete(titles).where(and(eq(titles.id, titleId), eq(titles.userId, userId)));
};

const ambientFor = async (posterPath: string | null | undefined) => {
  if (!posterPath) {
    return null;
  }
  try {
    return formatAmbientRgb(await sampleAmbientFromPosterPath(posterPath));
  } catch {
    return null;
  }
};

/**
 * «Tu película favorita de todos los tiempos»: watched, 5★ and in Favoritas, so the taste engine
 * gets its first anchor («Porque le diste 5★ a…»). Replacing a pick the flow created removes it.
 */
export const pickAllTimeFavorite = async (
  input: TmdbPickInput,
  previous?: { titleId: string; createdByFlow: boolean } | null,
): Promise<PickResult> => {
  const userId = await requireUserId();
  const result = await upsertTitleFromTmdbForUser(userId, { ...input, destination: "watched" });
  if (!result.ok) {
    return result;
  }

  const favoritasId = await fixedListId(userId, FAVORITAS_SLUG);
  await db
    .update(titles)
    .set({ rating: FAVORITE_RATING })
    .where(and(eq(titles.id, result.titleId), eq(titles.userId, userId)));
  if (favoritasId) {
    await appendToList(favoritasId, result.titleId);
    revalidateListMembership(favoritasId, result.titleId);
  }

  if (previous && previous.titleId !== result.titleId && previous.createdByFlow) {
    await deleteOwnedTitle(userId, previous.titleId);
  }

  revalidateRatingSurfaces(result.titleId);
  scheduleTonightRecompute(userId);

  return {
    ok: true,
    titleId: result.titleId,
    created: result.created,
    ambient: await ambientFor(input.posterPath),
  };
};

export type YearPickChangeInput = TmdbPickInput & {
  to: YearPickState;
  titleId?: string | null;
  createdByFlow?: boolean;
};

export type YearPickOutcome = { tmdbId: number; titleId: string | null; created: boolean };

/** «Lo mejor del año»: la vi = watched (unrated); favorita = watched + 5★; none = undo what the flow did. */
export const applyYearPicks = async (changes: YearPickChangeInput[]): Promise<YearPickOutcome[]> => {
  const userId = await requireUserId();
  const outcomes: YearPickOutcome[] = [];

  for (const change of changes.slice(0, 24)) {
    if (change.to === "none") {
      if (change.titleId) {
        if (change.createdByFlow) {
          await deleteOwnedTitle(userId, change.titleId);
        } else {
          // Pre-existing title: only drop the 5★ the flow may have set; never un-watch it.
          await db
            .update(titles)
            .set({ rating: null })
            .where(and(eq(titles.id, change.titleId), eq(titles.userId, userId), eq(titles.rating, FAVORITE_RATING)));
        }
      }
      outcomes.push({ tmdbId: change.tmdbId, titleId: change.createdByFlow ? null : (change.titleId ?? null), created: false });
      continue;
    }

    const result = await upsertTitleFromTmdbForUser(userId, { ...change, destination: "watched" });
    if (!result.ok) {
      outcomes.push({ tmdbId: change.tmdbId, titleId: change.titleId ?? null, created: false });
      continue;
    }
    await db
      .update(titles)
      .set({ rating: change.to === "favorite" ? FAVORITE_RATING : null })
      .where(and(eq(titles.id, result.titleId), eq(titles.userId, userId)));
    revalidateRatingSurfaces(result.titleId);
    outcomes.push({ tmdbId: change.tmdbId, titleId: result.titleId, created: result.created });
  }

  scheduleTonightRecompute(userId);
  return outcomes;
};

/** «¿Qué quieres ver?»: straight into Quiero ver. */
export const addWatchlistPick = async (input: TmdbPickInput): Promise<PickResult> => {
  const userId = await requireUserId();
  const result = await upsertTitleFromTmdbForUser(userId, { ...input, destination: "watchlist" });
  if (!result.ok) {
    return result;
  }
  revalidateWatchlistSurfaces(result.titleId);
  return { ok: true, titleId: result.titleId, created: result.created, ambient: null };
};

export const removeWatchlistPick = async (titleId: string, createdByFlow: boolean) => {
  const userId = await requireUserId();
  if (createdByFlow) {
    await deleteOwnedTitle(userId, titleId);
  } else {
    const watchlistId = await fixedListId(userId, WATCHLIST_SLUG);
    if (watchlistId) {
      await db
        .delete(listItems)
        .where(and(eq(listItems.listId, watchlistId), eq(listItems.titleId, titleId)));
    }
  }
  revalidateWatchlistSurfaces(titleId);
  scheduleTonightRecompute(userId);
};

/** Popular titles on the platforms the user just picked, minus what they already have. */
export const getOnboardingSuggestions = async (excludeTmdbIds: number[]): Promise<SuggestionItem[]> => {
  const userId = await requireUserId();
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { streamingPlatforms: true },
  });
  const platforms = parseStoredStreamingPlatforms(user?.streamingPlatforms);
  if (platforms.length === 0) {
    return [];
  }
  const [suggestions, library] = await Promise.all([
    getPlatformSuggestions(platforms),
    getOnboardingLibrary(userId),
  ]);
  const exclude = new Set([...excludeTmdbIds, ...library.map((entry) => entry.tmdbId)]);
  return suggestions.filter((item) => !exclude.has(item.tmdbId));
};

export const getOnboardingLibraryForUser = async () => {
  const userId = await requireUserId();
  return getOnboardingLibrary(userId);
};

/**
 * Titles just added to Quiero ver are enriched after the response (`after()`), but Hoy needs
 * providers and runtime to rank them. Fill the gaps inline, bounded, before computing.
 */
const enrichQueueInline = async (userId: string) => {
  const watchlist = await db.query.lists.findFirst({
    where: and(eq(lists.userId, userId), eq(lists.slug, WATCHLIST_SLUG)),
    columns: { id: true },
    with: {
      items: {
        with: {
          title: {
            columns: { id: true, watchedAt: true },
            with: {
              catalog: {
                columns: {
                  id: true,
                  tmdbId: true,
                  kind: true,
                  name: true,
                  runtimeMinutes: true,
                  watchProvidersMx: true,
                },
              },
            },
          },
        },
        orderBy: [asc(listItems.position)],
      },
    },
  });
  // The gaps live on the shared catalog row; filling them helps every user who has the film.
  const pending = (watchlist?.items ?? [])
    .flatMap((item) =>
      item.title.catalog && item.title.watchedAt == null ? [item.title.catalog] : [],
    )
    .filter(
      (film) => film.runtimeMinutes == null || !parseStoredWatchProviders(film.watchProvidersMx),
    )
    .slice(0, 12);

  if (pending.length === 0) {
    return;
  }

  await withTimeout(
    runPool(pending, 4, async (film) => {
      const tasks: Promise<unknown>[] = [];
      if (!parseStoredWatchProviders(film.watchProvidersMx)) {
        tasks.push(refreshWatchProvidersMx(film.id, film.tmdbId, film.kind).catch(() => null));
      }
      if (film.runtimeMinutes == null) {
        tasks.push(
          resolveTitleMetadata(film.tmdbId, film.kind)
            .then((resolved) =>
              db
                .update(catalog)
                .set({
                  runtimeMinutes: resolved.runtimeMinutes ?? null,
                  imdbId: resolved.imdbId,
                  imdbRating: resolved.imdbRating,
                  imdbVotes: resolved.imdbVotes ?? null,
                  awards: resolved.awards ?? null,
                  overview: resolved.overview ?? null,
                  tmdbGenres: resolved.tmdbGenres,
                  tmdbKeywords: resolved.tmdbKeywords ?? [],
                  tmdbPeople: resolved.tmdbPeople ?? [],
                  originalLanguage: resolved.originalLanguage ?? null,
                  posterPath: sql`COALESCE(${catalog.posterPath}, ${resolved.posterPath})`,
                  backdropPath: resolved.backdropPath ?? null,
                })
                .where(eq(catalog.id, film.id)),
            )
            .catch(() => null),
        );
      }
      await Promise.all(tasks);
    }),
    PAYOFF_ENRICH_TIMEOUT_MS,
    undefined,
  );
};

/** «Tu primera noche»: compute Hoy right now and return the top card for the visitor's clock. */
export const loadOnboardingPayoff = async (nowIso: string): Promise<PayoffPayload> => {
  const userId = await requireUserId();
  const now = Number.isNaN(Date.parse(nowIso)) ? new Date() : new Date(nowIso);
  await enrichQueueInline(userId);
  try {
    await computeTonightForUser(userId, now);
  } catch {
    // getTonightDecks recomputes lazily when the store is stale or empty.
  }
  const decks = await getTonightDecks(userId, now);
  const card = pickPayoffCard(decks, now);
  if (card) {
    return { kind: "card", card, queueSize: decks.queueSize };
  }
  return { kind: "empty", empty: payoffEmptyKind(decks), queueSize: decks.queueSize };
};

/** Finish or skip: lift the gate in the DB and re-mint the cookie. Idempotent. */
export const finishOnboarding = async (): Promise<{ ok: true }> => {
  const userId = await requireUserId();
  const [user] = await db
    .update(users)
    .set({ onboardedAt: sql`COALESCE(${users.onboardedAt}, now())`, onboardingStep: null })
    .where(eq(users.id, userId))
    .returning({ id: users.id, email: users.email, name: users.name });
  if (user) {
    await refreshSessionUser(user, { onboarded: true });
  }
  revalidateProfileSurfaces();
  return { ok: true };
};
