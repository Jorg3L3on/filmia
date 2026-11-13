import { addDays, mxToday } from "@/lib/cine-core";
import { mxDayStart, weekKeyOf } from "@/lib/juegos/core";
import { DIARIA_IDS, DIARIAS } from "@/lib/juegos/diarias/core";
import { MAYOR_DAILY_STEPS, MAYOR_ID } from "@/lib/juegos/mayor/core";

/**
 * La liga de la semana (FIL-I55-3, board Comp-4-liga). Pure: the points table and the week. The
 * league has no table of its own: points are computed on read from partidas, retos and the bingo.
 * Weeks run Monday to Sunday in Mexico City (`weekKeyOf`); every Monday starts from zero. No
 * prizes, one pool of every account, nobody who did not play, never an email.
 */

export { LIGA_ID, LIGA_PATH } from "@/lib/juegos/core";

/** The rules table shown on the page and used to add up. */
export const LIGA_POINTS = {
  /** A finished daily: up to this, in proportion to the score. */
  diaria: 100,
  dueloGanado: 60,
  /** Played and lost: points for playing. */
  dueloPerdido: 20,
  /** Same score on both sides: between a win and a loss. */
  dueloEmpate: 40,
  bingoLinea: 80,
} as const;

/**
 * Best possible score of a daily, where the engine knows it. A daily not listed here is scored
 * against the best score anyone made that day (so any daily the engine runs counts, with no
 * code per game); listing it makes it exact.
 */
export const DAILY_TOTALS: Readonly<Record<string, number>> = {
  [MAYOR_ID]: MAYOR_DAILY_STEPS,
  // FIL-I54: Detalle 18, Línea de tiempo 8, Reparto misterioso 6, La cuadrícula 9.
  ...Object.fromEntries(DIARIA_IDS.map((id) => [id, DIARIAS[id].total])),
};

/**
 * Points for one finished daily: `score` out of the game's total (or of the day's best when the
 * total is unknown), times 100, rounded. Never more than 100, never negative.
 */
export const dailyPoints = (input: { juego: string; score: number; dayBest: number }) => {
  const total = Math.max(DAILY_TOTALS[input.juego] ?? 0, input.dayBest, 1);
  return Math.max(0, Math.min(LIGA_POINTS.diaria, Math.round((LIGA_POINTS.diaria * input.score) / total)));
};

export type DueloOutcome = "ganado" | "perdido" | "empate";

export const dueloPoints = (outcome: DueloOutcome) =>
  outcome === "ganado" ? LIGA_POINTS.dueloGanado : outcome === "empate" ? LIGA_POINTS.dueloEmpate : LIGA_POINTS.dueloPerdido;

export type LigaEvent =
  | { userId: string; kind: "diaria"; at: Date; juego: string; score: number; dayBest: number }
  | { userId: string; kind: "duelo"; at: Date; outcome: DueloOutcome }
  /** `lines` new bingo lines completed during the week. */
  | { userId: string; kind: "bingo"; week: string; lines: number };

export const eventPoints = (event: LigaEvent) =>
  event.kind === "diaria" ? dailyPoints(event) : event.kind === "duelo" ? dueloPoints(event.outcome) : event.lines * LIGA_POINTS.bingoLinea;

/** The Mexico City week (its Monday, `YYYY-MM-DD`) an event belongs to. */
export const eventWeek = (event: LigaEvent) => (event.kind === "bingo" ? event.week : weekKeyOf(event.at));

/** `[from, to)` instants of a week, from its Monday. */
export const weekRange = (week: string) => ({ from: mxDayStart(week), to: mxDayStart(addDays(week, 7)) });

/** The Monday of the week before. */
export const previousWeek = (week: string) => addDays(week, -7);

const MONTHS_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];
const dayLabel = (day: string) => `${Number(day.slice(8, 10))} ${MONTHS_SHORT[Number(day.slice(5, 7)) - 1]}`;

/** «Del 9 al 15 nov», «Del 30 nov al 6 dic». */
export const weekLabel = (week: string) => {
  const sunday = addDays(week, 6);
  return week.slice(5, 7) === sunday.slice(5, 7) ? `Del ${Number(week.slice(8, 10))} al ${dayLabel(sunday)}` : `Del ${dayLabel(week)} al ${dayLabel(sunday)}`;
};

/** Days left in the week, today included (Sunday: 1). */
export const daysLeftInWeek = (now: Date) => {
  const today = mxToday(now);
  const monday = weekKeyOf(now);
  return 7 - Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${monday}T00:00:00Z`)) / 86_400_000);
};

export type LigaTotals = {
  userId: string;
  points: number;
  partidas: number;
  duelosGanados: number;
  duelos: number;
  bingoLineas: number;
};

/** Adds events up per person. Only people with at least one event appear. */
export const tallyLiga = (events: readonly LigaEvent[]): LigaTotals[] => {
  const byUser = new Map<string, LigaTotals>();
  for (const event of events) {
    if (event.kind === "bingo" && event.lines <= 0) continue;
    const row = byUser.get(event.userId) ?? { userId: event.userId, points: 0, partidas: 0, duelosGanados: 0, duelos: 0, bingoLineas: 0 };
    row.points += eventPoints(event);
    if (event.kind === "diaria") row.partidas += 1;
    if (event.kind === "duelo") {
      row.duelos += 1;
      if (event.outcome === "ganado") row.duelosGanados += 1;
    }
    if (event.kind === "bingo") row.bingoLineas += event.lines;
    byUser.set(event.userId, row);
  }
  return [...byUser.values()];
};

export type RankedLigaRow<T> = T & { place: number };

/** Most points first; the same points share a place. */
export const rankLiga = <T extends { points: number; name: string }>(rows: readonly T[]): RankedLigaRow<T>[] => {
  const sorted = [...rows].sort((a, b) => b.points - a.points || a.name.localeCompare(b.name, "es"));
  let place = 0;
  return sorted.map((row, index) => {
    if (index === 0 || sorted[index - 1]!.points !== row.points) place = index + 1;
    return { ...row, place };
  });
};

/** «14 partidas · 3 duelos ganados · 1 línea de bingo». */
export const ligaDetail = (row: Pick<LigaTotals, "partidas" | "duelosGanados" | "duelos" | "bingoLineas">) => {
  const parts: string[] = [];
  if (row.partidas > 0) parts.push(row.partidas === 1 ? "1 diaria" : `${row.partidas} diarias`);
  if (row.duelosGanados > 0) parts.push(row.duelosGanados === 1 ? "1 duelo ganado" : `${row.duelosGanados} duelos ganados`);
  else if (row.duelos > 0) parts.push(row.duelos === 1 ? "1 duelo jugado" : `${row.duelos} duelos jugados`);
  if (row.bingoLineas > 0) parts.push(row.bingoLineas === 1 ? "1 línea de bingo" : `${row.bingoLineas} líneas de bingo`);
  return parts.join(" · ");
};

/** «1.º», «2.º». */
export const ordinal = (place: number) => `${place}.º`;
