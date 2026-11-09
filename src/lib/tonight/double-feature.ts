import { formatClock } from "@/lib/tonight/time";

/**
 * «Termina HH:MM» and «+ Sesión doble» on Hoy (FIL-I46-2). Pure, so both are testable with a
 * fixed clock: the sala passes its own clock and the minutes left before bedtime.
 */

/** «Termina 23:47»: now + runtime. Without a runtime there is nothing to say. */
export const endsAtLabel = (now: Date | null, runtimeMinutes: number | null | undefined) => {
  if (!now || !runtimeMinutes || runtimeMinutes <= 0) {
    return null;
  }
  return `Termina ${formatClock(new Date(now.getTime() + runtimeMinutes * 60_000))}`;
};

export type DoubleFeatureCandidate = { id: string; runtimeMinutes: number | null | undefined };

/** A gap between the two films (pick the second, stand up, press play). */
export const DOUBLE_FEATURE_BREAK_MINUTES = 10;

/**
 * The second film of a double feature: the first title in deck order (the sala already ranked it
 * for tonight) whose runtime, added to the current one and a short break, still ends before
 * bedtime. Null without a bedtime, without the current runtime, or when nothing fits.
 */
export const pickDoubleFeature = <T extends DoubleFeatureCandidate>({
  current,
  candidates,
  remainingMinutes,
}: {
  current: DoubleFeatureCandidate;
  candidates: readonly T[];
  /** Minutes until bedtime; null when there is no bedtime to fit into. */
  remainingMinutes: number | null | undefined;
}): T | null => {
  if (remainingMinutes == null || remainingMinutes <= 0) {
    return null;
  }
  const first = current.runtimeMinutes;
  if (!first || first <= 0) {
    return null;
  }
  const left = remainingMinutes - first - DOUBLE_FEATURE_BREAK_MINUTES;
  if (left <= 0) {
    return null;
  }
  return (
    candidates.find(
      (candidate) =>
        candidate.id !== current.id &&
        candidate.runtimeMinutes != null &&
        candidate.runtimeMinutes > 0 &&
        candidate.runtimeMinutes <= left,
    ) ?? null
  );
};
