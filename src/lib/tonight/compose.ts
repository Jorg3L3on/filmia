import { genreSlug } from "@/lib/diary-picks";
import {
  GENRE_LENS_LIMIT,
  MAX_PER_GENRE,
  mmrSelect,
  PARA_TI_NAME,
  PARA_TI_SLUG,
  type ScoredCandidate,
} from "@/lib/tonight/select";
import type { TonightGenre, TonightLensKind, TonightReason } from "@/lib/tonight/types";

/**
 * Hoy shows, per lens, three films from Quiero ver and three recommended (FIL-I6-3). The queue
 * lenses are computed and stored as before; the recommended pool changes only at night, so the
 * 3 + 3 is composed when Hoy is read, with no network: this module is pure.
 */

export const QUEUE_SLOTS = 3;
export const RECO_SLOTS = 3;
export const DECK_SIZE = QUEUE_SLOTS + RECO_SLOTS;
/** Para ti plus this many genre lenses at most, as before. */
export const MAX_LENSES = GENRE_LENS_LIMIT + 1;

export const RECO_WILDCARD_REASON: TonightReason = {
  kind: "wildcard",
  text: "Comodín · fuera de lo que sueles ver",
  weight: 1,
  personal: true,
};

/** What composition needs from a card, whatever else it carries. */
export type ComposableCard = {
  id: string;
  wildcard: boolean;
  pinned: boolean;
  reasons: TonightReason[];
  genres?: TonightGenre[];
};

export type ComposeLens<T extends ComposableCard> = {
  slug: string;
  name: string;
  kind: TonightLensKind;
  titles: T[];
};

/** A recommended card with the pieces MMR and the wildcard need. */
export type RecoEntry<T extends ComposableCard> = { card: T; scored: ScoredCandidate };

const median = (values: number[]) => {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
    : (sorted[middle] ?? 0);
};

/** The recommendation furthest from your taste that is still good: below-median gusto, best quality. */
const pickRecoWildcard = <T extends ComposableCard>(pool: readonly RecoEntry<T>[]) => {
  const cut = median(pool.map((entry) => entry.scored.pick.components.gusto));
  let best: RecoEntry<T> | null = null;
  for (const entry of pool) {
    if (
      entry.scored.pick.components.gusto < cut &&
      (!best || entry.scored.pick.components.calidad > best.scored.pick.components.calidad)
    ) {
      best = entry;
    }
  }
  return best;
};

/** The genre a stored lens stands for: its name is the genre's, found on its own cards. */
const genreIdOfLens = (lens: ComposeLens<ComposableCard>) => {
  for (const card of lens.titles) {
    const match = card.genres?.find((genre) => genre.name === lens.name);
    if (match) {
      return match.id;
    }
  }
  return null;
};

const hasGenre = (entry: RecoEntry<ComposableCard>, genreId: number) =>
  entry.scored.title.genres.some((genre) => genre.id === genreId);

type Composed<T extends ComposableCard> = { titles: T[]; used: RecoEntry<T>[] };

const composeOne = <T extends ComposableCard>(
  lens: ComposeLens<T>,
  pool: readonly RecoEntry<T>[],
): Composed<T> | null => {
  if (pool.length === 0) {
    return null;
  }
  const pinned = lens.titles.filter((card) => card.pinned);
  const regular = lens.titles.filter((card) => !card.pinned && !card.wildcard);
  const wildcards = lens.titles.filter((card) => card.wildcard && !card.pinned);
  const queue = [...pinned, ...regular].slice(0, QUEUE_SLOTS);
  // A short queue is topped up with recommendations, up to a full deck.
  const slots = queue.length >= QUEUE_SLOTS ? RECO_SLOTS : DECK_SIZE - queue.length;

  // Para ti closes with a wildcard; choose it first so the rest is never a card short.
  const wild = lens.kind === "para-ti" && slots > 1 ? pickRecoWildcard(pool) : null;
  const rest = wild ? pool.filter((entry) => entry !== wild) : pool;
  const core = mmrSelect(
    rest.map((entry) => entry.scored),
    wild ? slots - 1 : slots,
    undefined,
    // Para ti spreads across genres; a genre lens is one genre by definition.
    lens.kind === "para-ti" ? MAX_PER_GENRE : slots,
  );
  const coreIds = new Set(core.map((item) => item.title.id));
  const used = rest.filter((entry) => coreIds.has(entry.scored.title.id));
  const picked: T[] = used.map((entry) => entry.card);
  if (wild) {
    picked.push({ ...wild.card, wildcard: true, reasons: [RECO_WILDCARD_REASON, ...wild.card.reasons] });
    used.push(wild);
  }

  // Not enough recommendations for this lens: the queue it already had fills the deck.
  const spare = [...regular.slice(Math.max(0, queue.length - pinned.length)), ...wildcards];
  const titles = [...queue, ...picked];
  for (const card of spare) {
    if (titles.length >= DECK_SIZE) {
      break;
    }
    titles.push(card);
  }
  return { titles, used };
};

/**
 * Compose the lenses: queue cards first (the pinned one leads), then the recommended ones that
 * belong to the lens, never repeating a film across lenses. Without recommendations the lenses
 * come back untouched, so Hoy behaves exactly as before. When the queue yields fewer lenses
 * than usual (or none), the genres the recommendations lean on open the missing ones.
 */
export const composeLenses = <T extends ComposableCard>(
  lenses: readonly ComposeLens<T>[],
  recos: readonly RecoEntry<T>[],
): ComposeLens<T>[] => {
  if (recos.length === 0) {
    return [...lenses];
  }
  const taken = new Set<string>();
  const available = (filter?: (entry: RecoEntry<T>) => boolean) =>
    recos.filter((entry) => !taken.has(entry.card.id) && (!filter || filter(entry)));

  const base: ComposeLens<T>[] = lenses.some((lens) => lens.kind === "para-ti")
    ? [...lenses]
    : [{ slug: PARA_TI_SLUG, name: PARA_TI_NAME, kind: "para-ti", titles: [] }, ...lenses];

  const composed: ComposeLens<T>[] = [];
  const claim = (lens: ComposeLens<T>, result: Composed<T> | null) => {
    if (!result) {
      composed.push(lens);
      return;
    }
    for (const entry of result.used) {
      taken.add(entry.card.id);
    }
    composed.push({ ...lens, titles: result.titles });
  };

  for (const lens of base) {
    const genreId = lens.kind === "para-ti" ? null : genreIdOfLens(lens);
    const pool =
      lens.kind === "para-ti"
        ? available()
        : genreId == null
          ? []
          : available((entry) => hasGenre(entry, genreId));
    claim(lens, composeOne(lens, pool));
  }

  // Open genre lenses from what is recommended, most common first, while there is room.
  const existingGenres = new Set(
    base.flatMap((lens) => {
      const id = lens.kind === "genre" ? genreIdOfLens(lens) : null;
      return id == null ? [] : [id];
    }),
  );
  while (composed.length < MAX_LENSES) {
    const counts = new Map<number, { genre: TonightGenre; count: number }>();
    for (const entry of available()) {
      for (const genre of entry.scored.title.genres) {
        if (existingGenres.has(genre.id)) {
          continue;
        }
        const current = counts.get(genre.id) ?? { genre, count: 0 };
        current.count += 1;
        counts.set(genre.id, current);
      }
    }
    const top = [...counts.values()]
      .filter((item) => item.count >= RECO_SLOTS)
      .sort((a, b) => b.count - a.count || a.genre.name.localeCompare(b.genre.name, "es"))[0];
    if (!top) {
      break;
    }
    existingGenres.add(top.genre.id);
    const lens: ComposeLens<T> = {
      slug: genreSlug(top.genre.name, top.genre.id),
      name: top.genre.name,
      kind: "genre",
      titles: [],
    };
    const result = composeOne(lens, available((entry) => hasGenre(entry, top.genre.id)));
    if (result && result.titles.length > 0) {
      claim(lens, result);
    }
  }

  return composed.filter((lens) => lens.titles.length > 0);
};

/**
 * Deck order inside a lens, after the clock has ranked it: the pinned card leads, then queue
 * and recommended alternate (queue first), and the wildcard closes. Each group keeps its rank.
 */
export const interleaveBySource = <
  T extends { pinned?: boolean; wildcard?: boolean; tonight?: { source?: "queue" | "reco" } | undefined; source?: "queue" | "reco" },
>(
  ranked: readonly T[],
): T[] => {
  const sourceOf = (card: T) => card.source ?? card.tonight?.source ?? "queue";
  const lead = ranked.filter((card) => card.pinned);
  const tail = ranked.filter((card) => !card.pinned && card.wildcard);
  const body = ranked.filter((card) => !card.pinned && !card.wildcard);
  const queue = body.filter((card) => sourceOf(card) === "queue");
  const reco = body.filter((card) => sourceOf(card) === "reco");
  const mixed: T[] = [];
  for (let index = 0; index < Math.max(queue.length, reco.length); index += 1) {
    const q = queue[index];
    const r = reco[index];
    if (q) {
      mixed.push(q);
    }
    if (r) {
      mixed.push(r);
    }
  }
  return [...lead, ...mixed, ...tail];
};
