import { and, eq, inArray } from "drizzle-orm";
import { catalog, db, titles } from "@/db";
import type { Platform, TitleKind } from "@/db/schema";
import { matchWatchProviderPlatform } from "@/lib/streaming-platforms";
import { fitsRuntime, foldGenre, matchesGenres } from "@/lib/tonight/budget";
import { getTonightDecks, type TonightCard, type TonightDecks } from "@/lib/tonight-store";

/**
 * «¿Qué vemos?» with filters (FIL-I20-3): the same cards as the Hoy screen (queue and recos,
 * Para ti first), filtered by where they stream in Mexico, runtime, kind and genre.
 */

export type RecommendFilters = {
  /** Only titles streaming (flatrate) on one of these; the person's platforms by default. */
  platforms?: Platform[];
  maxRuntimeMin?: number;
  kind?: TitleKind;
  genre?: string;
  /** Any of these (whole names): the Hoy «Ánimo» chips (FIL-I31-2). Applies with `genre`. */
  genres?: string[];
};

/** Platforms a card streams on in Mexico (flatrate only, like the sala). */
export const cardPlatforms = (card: Pick<TonightCard, "flatrateProviders">): Platform[] => {
  const platforms = new Set<Platform>();
  for (const offer of card.flatrateProviders ?? []) {
    const platform = matchWatchProviderPlatform(offer);
    if (platform) platforms.add(platform);
  }
  return [...platforms];
};

export const filterRecommendations = (decks: TonightDecks, filters: RecommendFilters): TonightCard[] => {
  const platforms = filters.platforms?.length ? filters.platforms : decks.userPlatforms;
  const genre = filters.genre ? foldGenre(filters.genre) : null;
  const seen = new Set<string>();
  const out: TonightCard[] = [];

  for (const lens of decks.lenses) {
    for (const card of lens.titles) {
      if (seen.has(card.id)) continue;
      seen.add(card.id);
      if (filters.kind && card.kind !== filters.kind) continue;
      if (!fitsRuntime(card.runtimeMinutes, filters.maxRuntimeMin)) continue;
      if (genre && !(card.genres ?? []).some((item) => foldGenre(item.name).includes(genre))) continue;
      if (!matchesGenres(card.genres, filters.genres)) continue;
      if (platforms.length > 0 && !cardPlatforms(card).some((platform) => platforms.includes(platform))) continue;
      out.push(card);
    }
  }
  return out;
};

export const recommendForUser = async (userId: string, filters: RecommendFilters, now = new Date()) => {
  const decks = await getTonightDecks(userId, now);
  return { decks, cards: filterRecommendations(decks, filters) };
};

export type CardRef = { catalogId: string; titleId: string | null; tmdbId: number };

/**
 * Queue cards carry the person's Title id and reco cards the catalog id (FIL-I6); outside the
 * sala both need the catalog id and the TMDB id.
 */
export const resolveCardRefs = async (userId: string, cards: readonly TonightCard[]) => {
  const queueIds = cards.filter((card) => card.source === "queue").map((card) => card.id);
  const recoIds = cards.filter((card) => card.source === "reco").map((card) => card.id);
  const [owned, recos] = await Promise.all([
    queueIds.length
      ? db
          .select({ titleId: titles.id, catalogId: catalog.id, tmdbId: catalog.tmdbId })
          .from(titles)
          .innerJoin(catalog, eq(catalog.id, titles.catalogId))
          .where(and(eq(titles.userId, userId), inArray(titles.id, queueIds)))
      : [],
    recoIds.length
      ? db.select({ catalogId: catalog.id, tmdbId: catalog.tmdbId }).from(catalog).where(inArray(catalog.id, recoIds))
      : [],
  ]);
  const refs = new Map<string, CardRef>();
  for (const row of owned) refs.set(row.titleId, { catalogId: row.catalogId, titleId: row.titleId, tmdbId: row.tmdbId });
  for (const row of recos) refs.set(row.catalogId, { catalogId: row.catalogId, titleId: null, tmdbId: row.tmdbId });
  return refs;
};
