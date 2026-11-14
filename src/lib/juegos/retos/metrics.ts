import { gte, or } from "drizzle-orm";
import { db, juegoRetos } from "@/db";
import { addDays } from "@/lib/cine-core";
import { mxDayStart, weekKeyOf } from "@/lib/juegos/core";

/**
 * `npm run metrics:juegos`, retos (FIL-I53-7): per Mexico City week, retos sent to an account, sent
 * by link, played and expired. Counts only: no ids, no names.
 */

export type RetoMetricRow = {
  juego: string;
  toUserId: string | null;
  status: string;
  sentAt: Date | null;
  expiresAt: Date;
  finishedAt: Date | null;
};

export type RetosWeek = { week: string; sent: number; byLink: number; played: number; expired: number };

/** Pure: a reto counts as sent the week it was sent, played the week it finished, expired the week its 48 h ran out. */
export const retosMetrics = (rows: readonly RetoMetricRow[], weeks: readonly string[], now: Date): RetosWeek[] =>
  weeks.map((week) => {
    const inWeek = (date: Date | null) => date != null && weekKeyOf(date) === week;
    // Only retos that reached someone can expire for them; a draft the sender never finished does not count.
    const expired = (row: RetoMetricRow) =>
      row.sentAt != null &&
      (row.status === "vencido" || (row.status === "abierto" && row.expiresAt.getTime() <= now.getTime())) && inWeek(row.expiresAt);
    return {
      week,
      sent: rows.filter((row) => row.toUserId != null && inWeek(row.sentAt)).length,
      byLink: rows.filter((row) => row.toUserId == null && inWeek(row.sentAt)).length,
      played: rows.filter((row) => row.status === "jugado" && inWeek(row.finishedAt)).length,
      expired: rows.filter(expired).length,
    };
  });

export const loadRetosMetrics = async (now = new Date(), weekCount = 6) => {
  const current = weekKeyOf(now);
  const weeks = Array.from({ length: weekCount }, (_, index) => addDays(current, -7 * (weekCount - 1 - index)));
  const since = mxDayStart(weeks[0]!);
  const rows = await db
    .select({
      juego: juegoRetos.juego,
      toUserId: juegoRetos.toUserId,
      status: juegoRetos.status,
      sentAt: juegoRetos.sentAt,
      expiresAt: juegoRetos.expiresAt,
      finishedAt: juegoRetos.finishedAt,
    })
    .from(juegoRetos)
    .where(or(gte(juegoRetos.sentAt, since), gte(juegoRetos.expiresAt, since), gte(juegoRetos.finishedAt, since)));
  return retosMetrics(rows, weeks, now);
};
