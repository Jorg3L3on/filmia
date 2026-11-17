import type { TitleKind } from "@/db/schema";
import {
  rankByLikeness,
  rankParaTi,
  unitHash,
  type ParaTiCandidate,
  type ParaTiTitle,
  type RankContext,
} from "@/lib/para-ti/rank";
import { itemVector } from "@/lib/tonight/features";
import type { TonightTitle } from "@/lib/tonight/types";

/**
 * The three ready shelves under «¿Qué se te antoja?» (FIL-I60-3), pure. They work with zero taps:
 * «Porque te gustó {título}» (or «Lo mejor valorado» at cold start), «Nuevo en tus plataformas»
 * and «Joyas que no has visto». Each holds up to 20; a shelf with fewer than 4 is left out.
 */

export const SHELF_SIZE = 20;
export const SHELF_MIN = 4;
/** «Nuevo en tus plataformas»: arrived on a platform within this many days. */
export const NEW_WINDOW_DAYS = 90;

export type ShelfId = "porque" | "mejor" | "nuevo" | "joyas";

export type Shelf = { id: ShelfId; title: string; titles: ParaTiTitle[] };

/** A title of the library that can anchor «Porque te gustó…». */
export type AnchorCandidate = {
  tmdbId: number;
  kind: TitleKind;
  title: TonightTitle;
};

/** Liked enough to anchor: 8 or more (or Favoritas), watched. */
const ANCHOR_MIN_RATING = 8;
const ANCHOR_POOL = 5;

/**
 * The day's anchor: one of the five best-rated watched titles (latest first on ties), rotating by
 * day so the shelf changes without changing within a day.
 */
export const pickAnchor = (library: readonly AnchorCandidate[], seed: string): AnchorCandidate | null => {
  const liked = library
    .filter(
      ({ title }) =>
        title.watchedAt != null &&
        ((title.rating != null && title.rating >= ANCHOR_MIN_RATING) || title.listSlugs.includes("favoritas")),
    )
    .sort(
      (a, b) =>
        (b.title.rating ?? 0) - (a.title.rating ?? 0) ||
        (b.title.watchedAt?.getTime() ?? 0) - (a.title.watchedAt?.getTime() ?? 0),
    )
    .slice(0, ANCHOR_POOL);
  if (liked.length === 0) return null;
  return liked[Math.floor(unitHash(`${seed}:ancla`) * liked.length)] ?? liked[0]!;
};

export type ShelvesInput = {
  /** Every pool, all antojos (for the anchor shelf and «Lo mejor valorado»). */
  pool: readonly ParaTiCandidate[];
  /** The «joya» pool. */
  joyas: readonly ParaTiCandidate[];
  /** Catalog rows that arrived on a platform lately (`availableSince`), any pool. */
  arrivals: readonly ParaTiCandidate[];
  anchor: AnchorCandidate | null;
  /** TMDB «recommendations» of the anchor (tmdb ids), cached a day. */
  related: ReadonlySet<number>;
  now: Date;
};

const keep = (shelf: Shelf): Shelf[] => (shelf.titles.length >= SHELF_MIN ? [shelf] : []);

export const buildShelves = (input: ShelvesInput, context: RankContext): Shelf[] => {
  const base: RankContext = { ...context, limit: SHELF_SIZE };
  const shelves: Shelf[] = [];

  if (!context.scorer || !input.anchor) {
    shelves.push(
      ...keep({ id: "mejor", title: "Lo mejor valorado", titles: rankParaTi(input.pool, { ...base, scorer: null }) }),
    );
  } else {
    shelves.push(
      ...keep({
        id: "porque",
        title: `Porque te gustó ${input.anchor.title.name}`,
        titles: rankByLikeness(input.pool, itemVector(input.anchor.title), input.related, base),
      }),
    );
  }

  const since = input.now.getTime() - NEW_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  // On your platforms by definition: the switch does not apply to this shelf.
  const recent = input.arrivals.filter((candidate) => (candidate.availableSince?.getTime() ?? 0) >= since);
  const arrivals = rankParaTi(recent, {
    ...base,
    filters: { ...base.filters, onlyMine: true },
    limit: recent.length,
  });
  const arrivedAt = new Map(recent.map((candidate) => [candidate.catalogId, candidate.availableSince?.getTime() ?? 0]));
  arrivals.sort((a, b) => (arrivedAt.get(b.catalogId) ?? 0) - (arrivedAt.get(a.catalogId) ?? 0));
  shelves.push(...keep({ id: "nuevo", title: "Nuevo en tus plataformas", titles: arrivals.slice(0, SHELF_SIZE) }));

  shelves.push(...keep({ id: "joyas", title: "Joyas que no has visto", titles: rankParaTi(input.joyas, base) }));
  return shelves;
};
