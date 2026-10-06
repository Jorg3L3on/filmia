/**
 * «Esta noche»: the hour drum. Slots run from 20:00 to 03:00 in 15-minute steps; post-midnight
 * hours wrap (00:00–03:00 belong to the same night, as `tonight/time.ts` treats them).
 */

export const BEDTIME_FIRST_MINUTES = 20 * 60; // 20:00
export const BEDTIME_LAST_MINUTES = 27 * 60; // 03:00 next day
export const BEDTIME_STEP_MINUTES = 15;
export const BEDTIME_SLOTS =
  (BEDTIME_LAST_MINUTES - BEDTIME_FIRST_MINUTES) / BEDTIME_STEP_MINUTES + 1; // 29

export type BedtimeTarget = "weekday" | "weekend";

export const BEDTIME_TARGET_LABEL: Record<BedtimeTarget, string> = {
  weekday: "Entre semana",
  weekend: "Viernes y sábado",
};

const pad = (value: number) => String(value).padStart(2, "0");

const clampSlot = (slot: number) => Math.min(BEDTIME_SLOTS - 1, Math.max(0, Math.round(slot)));

export const slotToHHMM = (slot: number) => {
  const minutes = (BEDTIME_FIRST_MINUTES + clampSlot(slot) * BEDTIME_STEP_MINUTES) % (24 * 60);
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
};

/** Madrugada hours belong to the previous night, as in `tonight/time.ts`. */
const WRAP_BEFORE_MINUTES = 6 * 60;

/** Nearest slot for an HH:MM: 00:00–05:59 wrap past midnight; daytime hours clamp to the drum's ends. */
export const hhmmToSlot = (hhmm: string): number => {
  const match = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!match) {
    return hhmmToSlot("23:30");
  }
  let minutes = Number(match[1]) * 60 + Number(match[2]);
  if (minutes < WRAP_BEFORE_MINUTES) {
    minutes += 24 * 60;
  }
  return clampSlot((minutes - BEDTIME_FIRST_MINUTES) / BEDTIME_STEP_MINUTES);
};

/** 0 at 20:00 → 1 at 03:00: drives the moon's height and the sky gradient. */
export const moonElevation = (slot: number) => clampSlot(slot) / (BEDTIME_SLOTS - 1);

export const bedtimeCopy = (hhmm: string) =>
  `Hoy te sugerirá lo que acabe antes de las ${hhmm}.`;

/** Weekend default: 90 minutes later than the weekday hour, capped at 03:00. */
export const suggestWeekendFrom = (weekday: string) =>
  slotToHHMM(hhmmToSlot(weekday) + 90 / BEDTIME_STEP_MINUTES);

/** Spoken value for the slider («once y media de la noche»-style is overkill; plain HH:MM reads fine). */
export const bedtimeValueText = (hhmm: string) => `${hhmm} h`;
