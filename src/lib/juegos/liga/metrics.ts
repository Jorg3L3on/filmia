import { gte } from "drizzle-orm";
import { db, juegoPartidas } from "@/db";
import { addDays } from "@/lib/cine-core";
import { JUEGOS, LIGA_ID, mxDayStart, weekKeyOf } from "@/lib/juegos/core";

/**
 * `npm run metrics:juegos`, la liga (FIL-I55-4): per Mexico City week, distinct people who played a
 * partida (any game, any mode) and partidas per person, marked before or after the league's
 * launch. It is what the four-week review compares. Counts only: no ids, no names.
 */

export type LigaMetricWeek = {
  week: string;
  players: number;
  partidas: number;
  /** Partidas per person, one decimal; null with nobody. */
  perPerson: number | null;
  /** «antes» or «después» of the liga's launch week; null without a launch date. */
  phase: "antes" | "después" | null;
};

/** The Monday of the liga's launch week, from the cartel. */
export const ligaLaunchWeek = () => {
  const on = JUEGOS.find((juego) => juego.id === LIGA_ID)?.launchedOn;
  return on ? weekKeyOf(mxDayStart(on)) : null;
};

/** Pure: rows are partidas (who and when they started). */
export const ligaMetrics = (
  rows: readonly { userId: string; startedAt: Date }[],
  weeks: readonly string[],
  launchWeek: string | null,
): LigaMetricWeek[] =>
  weeks.map((week) => {
    const inWeek = rows.filter((row) => weekKeyOf(row.startedAt) === week);
    const players = new Set(inWeek.map((row) => row.userId)).size;
    return {
      week,
      players,
      partidas: inWeek.length,
      perPerson: players === 0 ? null : Math.round((inWeek.length / players) * 10) / 10,
      phase: launchWeek == null ? null : week < launchWeek ? "antes" : "después",
    };
  });

/**
 * The last `weekCount` weeks; with `around` and a launch date, the four weeks before the launch
 * week and the four from it on (the review window), whatever today is.
 */
export const loadLigaMetrics = async (now = new Date(), weekCount = 6, around = false) => {
  const launch = ligaLaunchWeek();
  const anchor = around && launch ? addDays(launch, 21) : weekKeyOf(now);
  const count = around && launch ? 8 : weekCount;
  const weeks = Array.from({ length: count }, (_, index) => addDays(anchor, -7 * (count - 1 - index)));
  const rows = await db
    .select({ userId: juegoPartidas.userId, startedAt: juegoPartidas.startedAt })
    .from(juegoPartidas)
    .where(gte(juegoPartidas.startedAt, mxDayStart(weeks[0]!)));
  return { launchWeek: launch, weeks: ligaMetrics(rows, weeks, launch) };
};
