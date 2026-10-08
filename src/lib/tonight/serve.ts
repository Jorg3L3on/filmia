import { combineScore, fatigueMultiplier } from "@/lib/tonight/score";
import {
  fitForRuntime,
  formatRuntimeShort,
  isNight,
  remainingMinutes,
} from "@/lib/tonight/time";
import type {
  NightEnds,
  TonightComponents,
  TonightEvent,
  TonightFit,
  TonightReason,
} from "@/lib/tonight/types";

/** `?lente=` on Hoy. Shared with the server page: importing it from the "use client" sala
 * hands the server a client reference instead of the string, so deep links never matched. */
export const TONIGHT_LENS_PARAM = "lente";

/** What a card needs at read time (server or client) to be ranked for right now. */
export type RankableCard = {
  id: string;
  runtimeMinutes: number | null;
  components: TonightComponents;
  reasons: TonightReason[];
  wildcard: boolean;
  /** Chosen from Quiero ver for tonight (see `tonight/pin.ts`). */
  pinned?: boolean;
};

export type RankedCard<T extends RankableCard> = T & {
  fit: TonightFit;
  score: number;
  /** Two reasons for the pill + sheet: one personal, one objective when possible. */
  headline: TonightReason[];
};

export const fitReason = (fit: TonightFit, runtimeMinutes: number | null): TonightReason | null => {
  const runtime = formatRuntimeShort(runtimeMinutes);
  if (!runtime) {
    return null;
  }
  if (fit.overflowMinutes > 0) {
    return {
      kind: "fit_over",
      text:
        fit.remainingMinutes === 0
          ? "Ya pasó tu hora de dormir"
          : `Se pasa ${fit.overflowMinutes} min de tu hora`,
      detail: `Si empiezas ahora acaba a las ${fit.endsAt}`,
      // Decision-critical: always surfaces as the objective reason.
      weight: 0.3,
      personal: false,
    };
  }
  return {
    kind: "fit",
    text: `${runtime} · termina a tiempo`,
    detail: `Si empiezas ahora acaba a las ${fit.endsAt}`,
    weight: 0.12,
    personal: false,
  };
};

/** Pick the pill + sheet headline: best personal reason first, then the best objective one. */
export const pickHeadline = (reasons: readonly TonightReason[]) => {
  const sorted = [...reasons].sort((a, b) => b.weight - a.weight);
  const personal = sorted.find((reason) => reason.personal);
  const objective = sorted.find((reason) => !reason.personal && reason !== personal);
  const headline = [personal, objective].filter((reason): reason is TonightReason => Boolean(reason));
  if (headline.length === 0 && sorted[0]) {
    headline.push(sorted[0]);
  }
  return headline;
};

/**
 * Apply the clock (and fresh feedback) to precomputed cards: fit for the
 * remaining night, fatigue from the latest events, final score, headline.
 * By day the fit still scores (everything fits) but says nothing: «termina a
 * tiempo» only makes sense once it is night.
 */
export const rankForNow = <T extends RankableCard>(
  cards: readonly T[],
  options: {
    now: Date;
    nightEnds: NightEnds;
    eventsByTitle?: ReadonlyMap<string, TonightEvent[]>;
    keepWildcardLast?: boolean;
    /** The pinned card stays first whatever the clock says. */
    keepPinnedFirst?: boolean;
  },
): RankedCard<T>[] => {
  const remaining = remainingMinutes(options.now, options.nightEnds);
  const night = isNight(options.now, options.nightEnds);
  const ranked = cards.map((card) => {
    const fit = fitForRuntime(card.runtimeMinutes, remaining, options.now);
    const events = options.eventsByTitle?.get(card.id);
    const components = events
      ? { ...card.components, fatiga: fatigueMultiplier(events, options.now) }
      : card.components;
    const reason = night ? fitReason(fit, card.runtimeMinutes) : null;
    const reasons = reason ? [...card.reasons, reason] : card.reasons;
    return {
      ...card,
      components,
      fit,
      reasons,
      score: combineScore(components, fit.fit, fit.overflowMinutes),
      headline: pickHeadline(reasons),
    };
  });

  ranked.sort((a, b) => {
    if (options.keepPinnedFirst) {
      const pinnedA = Boolean(a.pinned);
      const pinnedB = Boolean(b.pinned);
      if (pinnedA !== pinnedB) {
        return pinnedA ? -1 : 1;
      }
    }
    if (options.keepWildcardLast) {
      if (a.wildcard !== b.wildcard) {
        return a.wildcard ? 1 : -1;
      }
    }
    return b.score - a.score;
  });

  return ranked;
};
