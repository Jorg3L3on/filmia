import type { Platform } from "@/db";
import { PLATFORM_SERVICE_LABEL } from "@/lib/labels";
import { DECK_SIZE, QUEUE_SLOTS } from "@/lib/tonight/compose";
import type { TonightReason } from "@/lib/tonight/types";

/**
 * Cold start (FIL-I47-3): how much Hoy knows about someone, and what it does while that is little.
 * Pure rules; the counts and writes live in `cold-start-store`.
 */

/** At this many signals the deck is recomputed and says it now uses your taste. */
export const SIGNAL_GOAL = 10;
/** Past this many, «Afina tu gusto» stops asking. */
export const SIGNAL_RICH = 40;

export type SignalCounts = {
  /** Watched titles with stars or an implied rating («Me gustó» / «No tanto»). */
  ratedWatched: number;
  /** Quiero ver entries. */
  queue: number;
  /** «No la he visto» answers in «Afina tu gusto»: nothing rated, still a signal. */
  tasteSkips: number;
};

/**
 * One number for «how much do we know»: rated watches + Quiero ver + taste skips. A taste answer
 * that saw the film already counts once, as a rated watch.
 */
export const countSignals = ({ ratedWatched, queue, tasteSkips }: SignalCounts) =>
  Math.max(0, ratedWatched) + Math.max(0, queue) + Math.max(0, tasteSkips);

export type AfinaMode = "full" | "compact" | "hidden";

/** The meter to 10 under 10 signals, one compact card up to 40, nothing above. */
export const afinaMode = (signals: number): AfinaMode =>
  signals < SIGNAL_GOAL ? "full" : signals <= SIGNAL_RICH ? "compact" : "hidden";

/** True when this answer is the one that reached the goal: recompute the deck once, say so. */
export const reachedSignalGoal = (before: number, after: number) => before < SIGNAL_GOAL && after >= SIGNAL_GOAL;

/**
 * A thin queue (fewer than three playable titles) takes the best of the user's charts, unless the
 * recommendations from their taste can already fill a deck: taste first, charts only as a floor.
 */
export const needsChartFill = (eligibleQueue: number, tasteRecos = 0) =>
  eligibleQueue < QUEUE_SLOTS && tasteRecos < DECK_SIZE;

export type ChartFillCandidate = {
  catalogId: string;
  platform: Platform;
  rank: number;
  source: "popularity" | "official";
  imdbRating: number | null;
};

/**
 * Quality first among the charted titles (IMDb, then rank), one entry per film (its best rank).
 * Unrated titles go last: they have no proof of quality yet.
 */
export const orderChartFill = <T extends ChartFillCandidate>(candidates: readonly T[]): T[] => {
  const best = new Map<string, T>();
  for (const candidate of candidates) {
    const current = best.get(candidate.catalogId);
    if (!current || candidate.rank < current.rank) best.set(candidate.catalogId, candidate);
  }
  return [...best.values()].sort(
    (a, b) => (b.imdbRating ?? -1) - (a.imdbRating ?? -1) || a.rank - b.rank || a.catalogId.localeCompare(b.catalogId),
  );
};

/**
 * «N.º 2 en Netflix esta semana» for an official list; «N.º 2 en lo más popular de Max» for a
 * popularity one, which never claims a viewing top.
 */
export const chartReason = (candidate: Pick<ChartFillCandidate, "platform" | "rank" | "source">): TonightReason => ({
  kind: "position",
  text:
    candidate.source === "official"
      ? `N.º ${candidate.rank} en ${PLATFORM_SERVICE_LABEL[candidate.platform]} esta semana`
      : `N.º ${candidate.rank} en lo más popular de ${PLATFORM_SERVICE_LABEL[candidate.platform]}`,
  weight: 0.35,
  personal: false,
});

/** Every card says why it is there: what a card without a reason of its own gets. */
export const fallbackReason = (card: {
  source: "queue" | "reco";
  imdbRating: number | null;
  /** Added to Quiero ver while choosing the first titles (FIL-I11). */
  fromOnboarding?: boolean;
}): TonightReason => {
  if (card.source === "reco") {
    return card.imdbRating != null
      ? { kind: "quality", text: `Recomendada · IMDb ${card.imdbRating.toFixed(1)}`, weight: 0.1, personal: false }
      : { kind: "reco_genre", text: "Recomendada para ti", weight: 0.1, personal: false };
  }
  return card.fromOnboarding
    ? { kind: "note", text: "Porque la elegiste al empezar", weight: 0.1, personal: true }
    : { kind: "note", text: "Está en tu Quiero ver", weight: 0.05, personal: true };
};

/** Adds the fallback only to cards with no reason at all. */
export const withReason = <
  T extends { reasons: TonightReason[]; source: "queue" | "reco"; imdbRating: number | null; fromOnboarding?: boolean },
>(
  card: T,
): T => (card.reasons.length > 0 ? card : { ...card, reasons: [fallbackReason(card)] });
