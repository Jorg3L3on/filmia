import type { NightEnds, TonightFit } from "@/lib/tonight/types";

export const DEFAULT_NIGHT_ENDS: NightEnds = { weekday: "23:30", weekend: "01:00" };

/** A typical evening when no clock is available (nightly precompute). */
export const TYPICAL_EVENING_MINUTES = 180;

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const isHHMM = (value: unknown): value is string =>
  typeof value === "string" && HHMM.test(value);

export const parseNightEnds = (value: unknown): NightEnds => {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    weekday: isHHMM(record.weekday) ? record.weekday : DEFAULT_NIGHT_ENDS.weekday,
    weekend: isHHMM(record.weekend) ? record.weekend : DEFAULT_NIGHT_ENDS.weekend,
  };
};

const minutesOf = (hhmm: string) => {
  const [hours, minutes] = hhmm.split(":").map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
};

/** Before 06:00 we are still in "last night": Saturday 01:30 belongs to Friday night. */
export const nightOf = (now: Date) => {
  const night = new Date(now);
  if (night.getHours() < 6) {
    night.setDate(night.getDate() - 1);
  }
  return night;
};

/** Weekend nights are Friday and Saturday (the ones that end late). */
export const isWeekendNight = (now: Date) => {
  const day = nightOf(now).getDay();
  return day === 5 || day === 6;
};

export const nightEndsLabel = (now: Date, nightEnds: NightEnds) =>
  isWeekendNight(now) ? nightEnds.weekend : nightEnds.weekday;

/** Absolute bedtime for tonight (local). Times before 06:00 roll to the next civil day. */
export const bedtimeFor = (now: Date, nightEnds: NightEnds) => {
  const label = nightEndsLabel(now, nightEnds);
  const target = minutesOf(label);
  const base = nightOf(now);
  const bedtime = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 0, 0, 0, 0);
  bedtime.setMinutes(target);
  if (target < 6 * 60) {
    bedtime.setDate(bedtime.getDate() + 1);
  }
  return bedtime;
};

export const remainingMinutes = (now: Date, nightEnds: NightEnds) => {
  const bedtime = bedtimeFor(now, nightEnds);
  return Math.max(0, Math.round((bedtime.getTime() - now.getTime()) / 60_000));
};

export const formatClock = (date: Date) =>
  `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;

export const formatRuntimeShort = (minutes: number | null | undefined) => {
  if (!minutes || minutes <= 0) {
    return null;
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) {
    return `${rest} min`;
  }
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
};

/** Overflow (minutes past bedtime) at which fit reaches 0. */
export const FIT_FADE_MINUTES = 45;
/** Past this overflow the title realistically does not fit: the score takes a cut. */
export const FIT_GATE_MINUTES = 60;
export const FIT_GATE_MULTIPLIER = 0.7;

/**
 * Fit of a runtime inside the remaining night: 1 when it ends before bedtime,
 * fading to 0 at 45 min past it. Unknown runtime = neutral 0.6.
 */
export const fitForRuntime = (
  runtimeMinutes: number | null | undefined,
  remaining: number,
  now: Date,
): TonightFit => {
  if (!runtimeMinutes || runtimeMinutes <= 0) {
    return { fit: 0.6, endsAt: "", overflowMinutes: 0, remainingMinutes: remaining };
  }
  const ends = new Date(now.getTime() + runtimeMinutes * 60_000);
  const overflow = Math.max(0, runtimeMinutes - remaining);
  const fit = overflow === 0 ? 1 : Math.max(0, 1 - overflow / FIT_FADE_MINUTES);
  return {
    fit,
    endsAt: formatClock(ends),
    overflowMinutes: overflow,
    remainingMinutes: remaining,
  };
};

export const monthsBetween = (from: Date, to: Date) =>
  Math.max(0, (to.getTime() - from.getTime()) / (30.44 * 24 * 60 * 60 * 1000));

export const daysBetween = (from: Date, to: Date) =>
  Math.max(0, (to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
