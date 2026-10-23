import { createId } from "@paralleldrive/cuid2";
import { and, eq, inArray } from "drizzle-orm";
import { catalog, db, pickEvents, titles, type CatalogRow, type Platform } from "@/db";
import { scheduleAfterResponse } from "@/lib/after-response";
import { scheduleCatalogEnrichment } from "@/lib/catalog-enrich";
import { catalogIdFor, findOrCreateCatalog } from "@/lib/catalog";
import { parseStoredTmdbGenres } from "@/lib/diary-picks";
import {
  OCULTA_LENS,
  OCULTA_NAME,
  ocultaDetail,
  ocultaHint,
  pickOculta,
  sameMxDay,
} from "@/lib/piezas/core";
import { filmCard } from "@/lib/rutas/hoy";
import { loadFactoryContext } from "@/lib/rutas/factories";
import { titleAvailableOnUserPlatforms } from "@/lib/streaming-platforms";
import { getTmdbRelated, isTmdbConfigured } from "@/lib/tmdb";
import type { RecoEntry } from "@/lib/tonight/compose";
import type { TonightCard, TonightLensView } from "@/lib/tonight-store";
import { fetchMxWatchProviders } from "@/lib/watch-providers";
import { withTimeout } from "@/lib/with-timeout";

/**
 * «La oculta» (FIL-I26-3, board P1): one film a day, face down, from the wildcard Hoy already
 * computes (under your median taste, the best rated). Accounts with no recommendations yet get
 * one from TMDB: what goes with your seeds but outside the genres you watch. The day is
 * remembered with `oculta_dealt`; it never repeats a card dealt before and never piles up.
 */

const FALLBACK_BUDGET_MS = 1200;
/** Known and well liked: a surprise, not a gamble. */
const FALLBACK_MIN_VOTES = 300;
const FALLBACK_MIN_RATING = 7.2;

const dealEvent = (userId: string, catalogId: string, now: Date) => ({
  id: createId(),
  userId,
  titleId: null,
  catalogId,
  kind: "oculta_dealt",
  lens: OCULTA_LENS,
  createdAt: now,
});

/**
 * TMDB's pairings for your seeds, as far from the genres you watch as they go (at least one genre
 * you never watch, the fewest shared), rated high and on your platforms.
 */
const ocultaFromSeeds = async (userId: string, exclude: ReadonlySet<string>, now: Date): Promise<CatalogRow | null> => {
  const ctx = await loadFactoryContext(userId, now);
  const yourGenres = new Set(ctx.seeds.filter((seed) => seed.watched).flatMap((seed) => seed.genreIds));
  const related = (
    await Promise.all(
      ctx.seeds.slice(0, 3).map((seed) => getTmdbRelated(seed.tmdbId, "MOVIE", "recommendations").catch(() => [])),
    )
  ).flat();
  const seenIds = new Set<number>();
  const candidates = related
    .filter((film) => {
      if (seenIds.has(film.tmdbId)) {
        return false;
      }
      seenIds.add(film.tmdbId);
      return (
        film.kind === "MOVIE" &&
        film.voteCount >= FALLBACK_MIN_VOTES &&
        (film.voteAverage ?? 0) >= FALLBACK_MIN_RATING &&
        !ctx.seenTmdbIds.has(film.tmdbId) &&
        !exclude.has(catalogIdFor("MOVIE", film.tmdbId)) &&
        film.genreIds.some((id) => !yourGenres.has(id))
      );
    })
    .map((film) => ({
      film,
      overlap: film.genreIds.filter((id) => yourGenres.has(id)).length / film.genreIds.length,
    }))
    .sort((a, b) => a.overlap - b.overlap || (b.film.voteAverage ?? 0) - (a.film.voteAverage ?? 0))
    .slice(0, 6);
  for (const { film } of candidates) {
    const onMine =
      ctx.platforms.length === 0 ||
      titleAvailableOnUserPlatforms(await fetchMxWatchProviders(film.tmdbId, "MOVIE").catch(() => null), ctx.platforms);
    if (!onMine) {
      continue;
    }
    const { row, created } = await findOrCreateCatalog({
      tmdbId: film.tmdbId,
      kind: "MOVIE",
      name: film.name,
      originalName: film.originalName,
      year: film.year,
      posterPath: film.posterPath,
    });
    if (created) {
      scheduleCatalogEnrichment(row);
    }
    await db.insert(pickEvents).values(dealEvent(userId, row.id, now));
    return row;
  }
  return null;
};

const ocultaCard = (
  film: CatalogRow,
  userPlatforms: readonly Platform[],
  options: { flipped: boolean; seedName: string | null; base?: TonightCard },
): TonightCard => {
  const genres = parseStoredTmdbGenres(film.tmdbGenres).map((genre) => genre.name);
  const card = options.base ?? filmCard(film, null, userPlatforms, []);
  return {
    ...card,
    wildcard: false,
    reasons: [
      { kind: "wildcard", text: "La oculta · fuera de lo que sueles ver", weight: 1, personal: true },
      ...card.reasons.filter((reason) => reason.kind !== "wildcard"),
    ],
    oculta: {
      hint: ocultaHint({ year: film.year, genres }),
      detail: ocultaDetail({ rating: film.imdbRating, seedName: options.seedName }),
      flipped: options.flipped,
    },
  };
};

/**
 * Today's oculta as a lens of one card, or null once it is seen (or nothing qualifies). `recos`
 * is the pool Hoy already loaded; `deckIds` the cards already dealt in other lenses.
 */
export const loadOcultaLens = async (
  userId: string,
  userPlatforms: readonly Platform[],
  now: Date,
  context: { recos: readonly RecoEntry<TonightCard>[]; deckIds: ReadonlySet<string> },
): Promise<TonightLensView | null> => {
  const events = await db.query.pickEvents.findMany({
    where: and(eq(pickEvents.userId, userId), inArray(pickEvents.kind, ["oculta_dealt", "oculta_flipped"])),
    columns: { catalogId: true, kind: true, createdAt: true },
  });
  const flipped = new Set(events.filter((event) => event.kind === "oculta_flipped").map((event) => event.catalogId));
  const today = events.find((event) => event.kind === "oculta_dealt" && sameMxDay(event.createdAt, now));

  const lens = (card: TonightCard): TonightLensView => ({
    slug: OCULTA_LENS,
    name: OCULTA_NAME,
    kind: "pieza",
    titles: [card],
  });

  if (today?.catalogId) {
    const [film, owned] = await Promise.all([
      db.query.catalog.findFirst({ where: eq(catalog.id, today.catalogId) }),
      db.query.titles.findFirst({
        where: and(eq(titles.userId, userId), eq(titles.catalogId, today.catalogId)),
        columns: { watchedAt: true },
      }),
    ]);
    if (!film || owned?.watchedAt) {
      return null;
    }
    const base = context.recos.find((entry) => entry.card.id === film.id)?.card;
    return lens(
      ocultaCard(film, userPlatforms, {
        flipped: flipped.has(film.id),
        seedName: base?.reco?.seedName ?? null,
        base,
      }),
    );
  }

  const dealt = new Set(events.flatMap((event) => (event.catalogId ? [event.catalogId] : [])));
  const exclude = new Set([...dealt, ...context.deckIds]);
  const pick = pickOculta(
    context.recos.map((entry) => ({
      id: entry.card.id,
      gusto: entry.scored.pick.components.gusto,
      calidad: entry.scored.pick.components.calidad,
      entry,
    })),
    exclude,
  );
  if (pick) {
    const film = await db.query.catalog.findFirst({ where: eq(catalog.id, pick.id) });
    if (!film) {
      return null;
    }
    await db.insert(pickEvents).values(dealEvent(userId, film.id, now));
    return lens(
      ocultaCard(film, userPlatforms, {
        flipped: false,
        seedName: pick.entry.card.reco?.seedName ?? null,
        base: pick.entry.card,
      }),
    );
  }

  if (!isTmdbConfigured()) {
    return null;
  }
  // No pool yet (a new account): TMDB, within a budget; past it the card is there next visit.
  const pending = ocultaFromSeeds(userId, exclude, now);
  scheduleAfterResponse(async () => {
    await pending.catch(() => null);
  });
  const film = await withTimeout(pending, FALLBACK_BUDGET_MS, null);
  return film ? lens(ocultaCard(film, userPlatforms, { flipped: false, seedName: null })) : null;
};

/** «Voltear»: remembered so the card stays face up today. */
export const flipOculta = async (userId: string, catalogId: string, now = new Date()) => {
  const dealt = await db.query.pickEvents.findFirst({
    where: and(eq(pickEvents.userId, userId), eq(pickEvents.kind, "oculta_dealt"), eq(pickEvents.catalogId, catalogId)),
    columns: { id: true },
  });
  if (!dealt) {
    return false;
  }
  await db.insert(pickEvents).values({
    id: createId(),
    userId,
    titleId: null,
    catalogId,
    kind: "oculta_flipped",
    lens: OCULTA_LENS,
    createdAt: now,
  });
  return true;
};
