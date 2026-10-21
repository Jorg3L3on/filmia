import { formatClock, formatRuntimeShort } from "@/lib/tonight/time";
import type { TonightFit } from "@/lib/tonight/types";

/** Past this much overflow the line says nothing useful: the runtime chip carries the warning. */
export const NIGHT_LINE_MAX_OVERFLOW_MINUTES = 30;

export type NightLineInput = {
  runtimeMinutes: number | null | undefined;
  /** A series measures one episode. */
  kind: "MOVIE" | "SERIES";
  fit: TonightFit | null | undefined;
  /** Only at night does the clock shape the sala. */
  night: boolean;
  now: Date;
};

export type NightLine =
  /** By day, or without a runtime: nothing to draw, the chip is just the runtime. */
  | { state: "none"; runtime: string | null }
  | {
      state: "fits";
      runtime: string;
      startsAt: string;
      endsAt: string;
      bedtimeAt: string;
      /** Where the film ends along the track (0–1, bedtime = 1). */
      endRatio: number;
      episode: boolean;
      label: string;
    }
  | {
      state: "over";
      runtime: string;
      startsAt: string;
      endsAt: string;
      bedtimeAt: string;
      overflowMinutes: number;
      /** Where bedtime sits along the track (0–1, the film's end = 1). */
      bedtimeRatio: number;
      episode: boolean;
      label: string;
    }
  /** Overflows more than 30 min: no line; the runtime chip says «se pasa …» in amber. */
  | { state: "over-long"; runtime: string; overflowLabel: string }
  /** Bedtime already passed: a dimmed line that says when it would end. */
  | { state: "past"; runtime: string; bedtimeAt: string; endsAt: string; episode: boolean; label: string };

/**
 * «Línea de la noche» (FIL-I21-5): what the 2 px track under the chips should draw for a card,
 * from the engine's fit (ends at, overflow, minutes left) and the viewer's clock.
 * Pure, so the states are testable with an injected clock.
 */
export const nightLineFor = ({ runtimeMinutes, kind, fit, night, now }: NightLineInput): NightLine => {
  const runtime = formatRuntimeShort(runtimeMinutes);
  if (!runtime || !runtimeMinutes || !night || !fit || !fit.endsAt) {
    return { state: "none", runtime };
  }
  const episode = kind === "SERIES";
  const startsAt = formatClock(now);
  const bedtimeAt = formatClock(new Date(now.getTime() + fit.remainingMinutes * 60_000));
  const endsAt = fit.endsAt;
  const subject = episode ? "un capítulo" : "";

  if (fit.remainingMinutes === 0) {
    return {
      state: "past",
      runtime,
      bedtimeAt,
      endsAt,
      episode,
      label: `Ya pasó tu hora, ${bedtimeAt}; ${subject ? `${subject} ` : ""}acabaría ${endsAt}`,
    };
  }

  if (fit.overflowMinutes === 0) {
    return {
      state: "fits",
      runtime,
      startsAt,
      endsAt,
      bedtimeAt,
      endRatio: Math.min(1, runtimeMinutes / Math.max(1, fit.remainingMinutes)),
      episode,
      label: `${episode ? "Un capítulo empieza" : "Empieza"} ${startsAt} y acaba ${endsAt}; tu hora es ${bedtimeAt}`,
    };
  }

  if (fit.overflowMinutes <= NIGHT_LINE_MAX_OVERFLOW_MINUTES) {
    return {
      state: "over",
      runtime,
      startsAt,
      endsAt,
      bedtimeAt,
      overflowMinutes: fit.overflowMinutes,
      bedtimeRatio: Math.min(1, fit.remainingMinutes / runtimeMinutes),
      episode,
      label: `${episode ? "Un capítulo empieza" : "Empieza"} ${startsAt} y acaba ${endsAt}, ${fit.overflowMinutes} min después de tu hora, ${bedtimeAt}`,
    };
  }

  return {
    state: "over-long",
    runtime,
    overflowLabel: `se pasa ${formatRuntimeShort(fit.overflowMinutes) ?? `${fit.overflowMinutes} min`}`,
  };
};
