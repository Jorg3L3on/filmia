import type { CatalogRow, Platform } from "@/db";
import { scheduleAfterResponse } from "@/lib/after-response";
import { toCoverflowTitle } from "@/lib/coverflow-title";
import { parseThreadPeople, rutaLensSlug, rutasDoor, TU_RUTA_NAME } from "@/lib/rutas/core";
import { ensureDayOneRuta, offerRutas, type RutaOffer } from "@/lib/rutas/factories";
import { countRutasByStatus, loadRutas, type RutaStepView, type RutaView } from "@/lib/rutas/store";
import type { TonightCard, TonightLensView } from "@/lib/tonight-store";
import type { TonightComponents, TonightReason } from "@/lib/tonight/types";
import { withTimeout } from "@/lib/with-timeout";

/**
 * «Tu ruta» in Hoy (FIL-I26-1): one lens per active ruta with the step to watch next. The first
 * is «Tu ruta», a second one is called by its ruta («Lord & Miller»). Where they go and how the
 * deck avoids repeating their films is `placeRutaLenses` (core.ts).
 */

/** How long Hoy waits for a first ruta to be built; past it, it lands on the next visit. */
export const DAY_ONE_BUDGET_MS = 1500;

/** Rutas have no score: a neutral card the clock can still rank and fit. */
const NEUTRAL: TonightComponents = { gusto: 0.6, calidad: 0.6, impulso: 0.5, novedad: 0, reposo: 0, fatiga: 1 };

/**
 * A film of the catalog as a Hoy card. Owned (the person has a `Title`): a queue card on that
 * title. Not owned: it acts like a recommendation, so «Vi esto» saves it as seen.
 */
export const filmCard = (
  film: CatalogRow,
  titleId: string | null,
  userPlatforms: readonly Platform[],
  reasons: TonightReason[],
): TonightCard => ({
  ...toCoverflowTitle(
    {
      id: titleId ?? film.id,
      name: film.name,
      kind: film.kind,
      year: film.year,
      rating: null,
      posterPath: film.posterPath,
      platform: null,
      imdbRating: film.imdbRating,
      watchedAt: null,
      review: null,
      seriesStatus: null,
      watchProvidersMx: film.watchProvidersMx,
      tmdbGenres: film.tmdbGenres,
    },
    userPlatforms,
  ),
  runtimeMinutes: film.runtimeMinutes,
  components: NEUTRAL,
  reasons,
  wildcard: false,
  pinned: false,
  posterAmbient: film.posterAmbient,
  queueNote: null,
  overview: film.overview,
  leads: parseThreadPeople(film.tmdbPeople)
    .filter((person) => person.role === "director")
    .map((person) => ({ id: person.id, name: person.name, role: "director" as const })),
  source: titleId ? "queue" : "reco",
  reco: titleId
    ? null
    : {
        tmdbId: film.tmdbId,
        seedName: null,
        sourceKind: "recommendations",
        originalName: film.originalName,
        backdropPath: film.backdropPath,
        overview: film.overview,
      },
});

const rutaCard = (view: RutaView, step: RutaStepView, userPlatforms: readonly Platform[]): TonightCard => {
  const index = view.steps.indexOf(step);
  const after = view.steps.slice(index + 1).find((item) => item.state === "hidden") ?? null;
  return {
    ...filmCard(step.film, step.titleId, userPlatforms, [
      { kind: "ruta", text: step.why, detail: view.reason ?? undefined, weight: 1, personal: true },
    ]),
    ruta: {
      rutaId: view.id,
      title: view.title,
      shortTitle: view.shortTitle,
      done: view.progress.done,
      total: view.progress.total,
      step: index + 1,
      why: step.why,
      nextHint: after?.hint ?? null,
    },
  };
};

export type RutaLenses = {
  lenses: TonightLensView[];
  /** Ids the ruta cards use (title and catalog ids): other lenses drop them. */
  cardIds: Set<string>;
  /** No active ruta: the door that offers one (never starts it). */
  door: TonightLensView | null;
};

/** Hoy never waits long for an offer: past this the door invites without one (TMDB keeps caching). */
export const RUTAS_DOOR_BUDGET_MS = 800;

const loadRutasDoor = async (userId: string) => {
  const counts = await countRutasByStatus(userId);
  if (counts.espera > 0) {
    return rutasDoor(counts.espera, null);
  }
  const offers = offerRutas(userId, { limit: 1 }).catch(() => [] as RutaOffer[]);
  scheduleAfterResponse(async () => {
    await offers;
  });
  const [offer] = await withTimeout(offers, RUTAS_DOOR_BUDGET_MS, [] as RutaOffer[]);
  return rutasDoor(0, offer ?? null);
};

/**
 * The person's active rutas as lenses, freshest first. Someone who never had a ruta gets the
 * first one built here (day one); if TMDB is slow it finishes after the response.
 */
export const loadRutaLenses = async (
  userId: string,
  userPlatforms: readonly Platform[],
  now: Date,
): Promise<RutaLenses> => {
  let views = await loadRutas(userId, { statuses: ["activa"], now });
  if (views.length === 0) {
    const pending = ensureDayOneRuta(userId, "hoy");
    scheduleAfterResponse(async () => {
      await pending.catch(() => null);
    });
    const created = await withTimeout(pending, DAY_ONE_BUDGET_MS, null);
    if (created) {
      views = await loadRutas(userId, { statuses: ["activa"], now });
    }
  }

  // Reading stamps the rutas: a seasonal one that just ran out comes back archived and leaves Hoy.
  const ordered = views
    .filter((view) => view.status === "activa")
    .sort((a, b) => b.lastActivityAt.getTime() - a.lastActivityAt.getTime());
  const lenses: TonightLensView[] = [];
  const cardIds = new Set<string>();
  for (const view of ordered) {
    const next = view.progress.nextIndex == null ? null : view.steps[view.progress.nextIndex];
    if (!next || next.film.kind !== "MOVIE") {
      continue;
    }
    const card = rutaCard(view, next, userPlatforms);
    cardIds.add(next.catalogId);
    if (next.titleId) {
      cardIds.add(next.titleId);
    }
    lenses.push({
      slug: rutaLensSlug(view.id),
      name: lenses.length === 0 ? TU_RUTA_NAME : view.shortTitle,
      kind: "ruta",
      titles: [card],
    });
  }
  const door = ordered.length === 0 ? await loadRutasDoor(userId).catch(() => rutasDoor(0, null)) : null;
  return { lenses, cardIds, door };
};
