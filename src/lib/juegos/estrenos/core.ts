import { addDays } from "@/lib/cine-core";

/**
 * Quiniela de estrenos (FIL-I55-1, board G-2-estrenos). Pure rules: which releases enter a month,
 * when a forecast closes, who was closest, and when others' forecasts may be shown. Ratings are
 * kept in tenths (74 = 7.4) so a tie is an exact equality.
 *
 * Everyone competes in one pool (no groups). Nothing here writes to `Title`.
 */

export const ESTRENOS_ID = "estrenos";
export const ESTRENOS_PATH = "/extras/estrenos";

/** The month's most awaited releases on the quiniela. */
export const ESTRENOS_PER_MONTH = 3;
/** Days after the release the cron reads the IMDb rating. */
export const RESOLVE_AFTER_DAYS = 14;
/** Where the stepper starts when the person has no forecast yet. */
export const DEFAULT_GUESS = 70;
export const MIN_GUESS = 10;
export const MAX_GUESS = 100;

/** `YYYY-MM` of a `YYYY-MM-DD`. */
export const monthOf = (day: string) => day.slice(0, 7);

/** First and last day (`YYYY-MM-DD`) of a `YYYY-MM`. */
export const monthBounds = (month: string) => {
  const [year, monthIndex] = month.split("-").map(Number) as [number, number];
  const last = new Date(Date.UTC(year, monthIndex, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
};

/** The `YYYY-MM` before this one. */
export const previousMonth = (month: string) => monthOf(addDays(`${month}-01`, -1));

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** «diciembre». */
export const monthName = (month: string) => MONTHS[Number(month.slice(5, 7)) - 1] ?? month;

/** «12 dic». */
export const shortDay = (day: string) => `${Number(day.slice(8, 10))} ${monthName(monthOf(day)).slice(0, 3)}`;

export const resolveOnOf = (releaseDate: string) => addDays(releaseDate, RESOLVE_AFTER_DAYS);

/** A forecast can be saved or changed only before the release day (Mexico City). */
export const isForecastOpen = (releaseDate: string, today: string) => today < releaseDate;

/** Whole days from `today` to `releaseDate` (0 on the day). */
export const daysUntil = (releaseDate: string, today: string) =>
  Math.round((Date.parse(`${releaseDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);

/** A forecast in tenths, clamped to 1.0–10.0; null when it is not a whole number of tenths. */
export const parseGuess = (value: unknown): number | null => {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isInteger(number) || number < MIN_GUESS || number > MAX_GUESS) return null;
  return number;
};

/** «7.4» from 74. */
export const tenths = (value: number) => (value / 10).toFixed(1);

/** An IMDb rating (7.14) as tenths (71). */
export const ratingToTenths = (rating: number) => Math.round(rating * 10);

/**
 * The winners of a resolved release: every forecast at the smallest distance from `actual`. Two
 * people at the same distance (7.0 and 7.2 for a 7.1) both win: a tie is a tie.
 */
export const closestOf = <T extends { guess: number }>(forecasts: readonly T[], actual: number): T[] => {
  if (forecasts.length === 0) return [];
  const best = Math.min(...forecasts.map((forecast) => Math.abs(forecast.guess - actual)));
  return forecasts.filter((forecast) => Math.abs(forecast.guess - actual) === best);
};

/**
 * Others' forecasts reach the client only once the person saved their own, or once forecasts are
 * closed (nothing left to copy). Before that the server sends only how many voted.
 */
export const mayRevealOthers = (input: { mine: number | null; releaseDate: string; today: string }) =>
  input.mine != null || !isForecastOpen(input.releaseDate, input.today);

export type EstrenoPhase = "abierta" | "cerrada" | "pendiente" | "resuelta";

/** Where a release stands on `today`: open, closed (released), waiting for its rating, resolved. */
export const estrenoPhase = (input: { releaseDate: string; resolveOn: string; actual: number | null }, today: string): EstrenoPhase => {
  if (input.actual != null) return "resuelta";
  if (isForecastOpen(input.releaseDate, today)) return "abierta";
  return today < input.resolveOn ? "cerrada" : "pendiente";
};

/** The chip on a release card. */
export const estrenoChip = (input: { releaseDate: string; resolveOn: string; actual: number | null }, today: string) => {
  const phase = estrenoPhase(input, today);
  if (phase === "resuelta") return "resuelta";
  if (phase === "pendiente") return "esperando la nota";
  if (phase === "cerrada") return `se resuelve el ${shortDay(input.resolveOn)}`;
  const days = daysUntil(input.releaseDate, today);
  return days === 1 ? "cierra mañana" : `cierra en ${days} días`;
};

export type EstrenoCandidate = { catalogId: string; mxReleaseDate: string; popularity: number };

/**
 * The month's picks: the releases already on it are kept; free places (up to
 * `ESTRENOS_PER_MONTH`) are filled by the most popular releases of the month that still open
 * forecasts on `today`, so a late addition never arrives already closed.
 */
export const pickEstrenos = (input: {
  month: string;
  today: string;
  existing: readonly string[];
  candidates: readonly EstrenoCandidate[];
}): EstrenoCandidate[] => {
  const free = ESTRENOS_PER_MONTH - input.existing.length;
  if (free <= 0) return [];
  const { from, to } = monthBounds(input.month);
  const taken = new Set(input.existing);
  return input.candidates
    .filter((candidate) => !taken.has(candidate.catalogId))
    .filter((candidate) => candidate.mxReleaseDate >= from && candidate.mxReleaseDate <= to)
    .filter((candidate) => isForecastOpen(candidate.mxReleaseDate, input.today))
    .sort((a, b) => b.popularity - a.popularity || a.catalogId.localeCompare(b.catalogId))
    .slice(0, free);
};
