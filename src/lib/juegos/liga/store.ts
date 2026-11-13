import { alias } from "drizzle-orm/pg-core";
import { and, eq, gte, inArray, isNotNull, lt, sql, type SQL } from "drizzle-orm";
import { db, juegoPartidas, juegoRetos, users } from "@/db";
import { addDays, mxToday } from "@/lib/cine-core";
import { bingoCardOf, completeLines, assignBingo } from "@/lib/juegos/bingo/core";
import { loadDatedFilms } from "@/lib/juegos/bingo/store";
import { weekKeyOf } from "@/lib/juegos/core";
import { monthBounds, monthOf } from "@/lib/juegos/estrenos/core";
import {
  previousWeek,
  rankLiga,
  tallyLiga,
  weekRange,
  type LigaEvent,
  type LigaTotals,
  type RankedLigaRow,
} from "@/lib/juegos/liga/core";
import { initialOf, retoNames, retoOutcome } from "@/lib/juegos/retos/core";

/**
 * La liga on the database (FIL-I55-3): only reads. Dailies (any game the engine runs), retos
 * between two accounts and bingo lines become events; `liga/core.ts` adds them up.
 */

/** The bingo started in this month: the all-time table counts its lines from here. */
export const LIGA_FIRST_MONTH = "2026-11";

type Range = { from: Date; to: Date } | null;

const inRange = (column: typeof juegoPartidas.finishedAt | typeof juegoRetos.finishedAt, range: Range): SQL[] =>
  range ? [gte(column, range.from), lt(column, range.to)] : [];

/** Finished dailies, each with the best score of its day (for dailies without a declared total). */
export const loadDailyEvents = async (range: Range): Promise<LigaEvent[]> => {
  const rows = await db
    .select({
      userId: juegoPartidas.userId,
      juego: juegoPartidas.juego,
      score: juegoPartidas.score,
      finishedAt: juegoPartidas.finishedAt,
      // Plain SQL on purpose: the outer row is named by its table so the subquery cannot capture it.
      dayBest: sql<number>`(
        select coalesce(max(b."score"), 0)::int from "JuegoPartida" b
        where b."juego" = "JuegoPartida"."juego" and b."lens" = "JuegoPartida"."lens"
          and b."day" = "JuegoPartida"."day" and b."mode" = 'diaria' and b."finishedAt" is not null
      )`
    })
    .from(juegoPartidas)
    .where(and(eq(juegoPartidas.mode, "diaria"), isNotNull(juegoPartidas.finishedAt), ...inRange(juegoPartidas.finishedAt, range)));
  return rows.map((row) => ({ userId: row.userId, kind: "diaria", at: row.finishedAt!, juego: row.juego, score: row.score, dayBest: row.dayBest }));
};

/**
 * Finished retos between two accounts: one event per side. A link reto (someone without an
 * account) does not count: it could be played against oneself.
 */
export const loadDueloEvents = async (range: Range): Promise<LigaEvent[]> => {
  const fromPartida = alias(juegoPartidas, "from_partida");
  const toPartida = alias(juegoPartidas, "to_partida");
  const rows = await db
    .select({
      fromUserId: juegoRetos.fromUserId,
      toUserId: juegoRetos.toUserId,
      finishedAt: juegoRetos.finishedAt,
      fromScore: fromPartida.score,
      toScore: toPartida.score,
    })
    .from(juegoRetos)
    .innerJoin(fromPartida, and(eq(fromPartida.id, juegoRetos.fromPartidaId), isNotNull(fromPartida.finishedAt)))
    .innerJoin(toPartida, and(eq(toPartida.id, juegoRetos.toPartidaId), isNotNull(toPartida.finishedAt)))
    .where(and(eq(juegoRetos.status, "jugado"), isNotNull(juegoRetos.toUserId), isNotNull(juegoRetos.finishedAt), ...inRange(juegoRetos.finishedAt, range)));
  return rows.flatMap((row): LigaEvent[] => {
    const outcome = retoOutcome(row.fromScore, row.toScore);
    const at = row.finishedAt!;
    return [
      { userId: row.fromUserId, kind: "duelo", at, outcome: outcome === "empate" ? "empate" : outcome === "from" ? "ganado" : "perdido" },
      { userId: row.toUserId!, kind: "duelo", at, outcome: outcome === "empate" ? "empate" : outcome === "to" ? "ganado" : "perdido" },
    ];
  });
};

/** Complete lines of each person on a month's card, counting films logged up to `upTo` (inclusive). */
const linesByUser = (month: string, films: Awaited<ReturnType<typeof loadDatedFilms>>, upTo: string) => {
  const card = bingoCardOf(month);
  const out = new Map<string, number>();
  const byUser = new Map<string, typeof films>();
  for (const film of films) if (film.watchedDay <= upTo) byUser.set(film.userId, [...(byUser.get(film.userId) ?? []), film]);
  for (const [userId, rows] of byUser) out.set(userId, completeLines(assignBingo(card, rows).map((index) => index != null)).length);
  return out;
};

/**
 * Bingo lines completed during a week: lines with the films up to Sunday minus lines with the films
 * up to the Saturday before, per month the week touches. A week's lines never change later weeks.
 */
export const loadBingoWeekEvents = async (week: string): Promise<LigaEvent[]> => {
  const sunday = addDays(week, 6);
  const months = [...new Set([monthOf(week), monthOf(sunday)])];
  const events: LigaEvent[] = [];
  for (const month of months) {
    const { from, to } = monthBounds(month);
    const films = await loadDatedFilms({ from, to });
    if (films.length === 0) continue;
    const end = sunday < to ? sunday : to;
    const before = addDays(week, -1);
    const now = linesByUser(month, films, end);
    const was = before >= from ? linesByUser(month, films, before) : new Map<string, number>();
    for (const [userId, lines] of now) {
      const added = lines - (was.get(userId) ?? 0);
      if (added > 0) events.push({ userId, kind: "bingo", week, lines: added });
    }
  }
  return events;
};

/** Every bingo line since the league began (each month's card with its films so far). */
export const loadBingoAllTimeEvents = async (now = new Date()): Promise<LigaEvent[]> => {
  const today = mxToday(now);
  const events: LigaEvent[] = [];
  for (let month = LIGA_FIRST_MONTH; month <= monthOf(today); month = monthOf(addDays(monthBounds(month).to, 1))) {
    const { from, to } = monthBounds(month);
    const films = await loadDatedFilms({ from, to });
    for (const [userId, lines] of linesByUser(month, films, to)) if (lines > 0) events.push({ userId, kind: "bingo", week: "todo", lines });
  }
  return events;
};

export type LigaTab = "semana" | "pasada" | "historico";
export const parseLigaTab = (value: unknown): LigaTab => (value === "pasada" || value === "historico" ? value : "semana");

export type LigaRow = RankedLigaRow<LigaTotals & { name: string; initial: string; me: boolean }>;

/** A table: «semana» (this week), «pasada» (last week) or «historico» (since the league began). */
export const loadLiga = async (userId: string, tab: LigaTab, now = new Date()): Promise<{ week: string | null; rows: LigaRow[] }> => {
  const week = tab === "semana" ? weekKeyOf(now) : tab === "pasada" ? previousWeek(weekKeyOf(now)) : null;
  const range = week ? weekRange(week) : null;
  const [dailies, duelos, bingo] = await Promise.all([
    loadDailyEvents(range),
    loadDueloEvents(range),
    week ? loadBingoWeekEvents(week) : loadBingoAllTimeEvents(now),
  ]);
  const totals = tallyLiga([...dailies, ...duelos, ...bingo]).filter((row) => row.points > 0);
  const ids = totals.map((row) => row.userId);
  const people = ids.length ? await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, ids)) : [];
  const names = retoNames(people);
  return {
    week,
    rows: rankLiga(
      totals.map((row) => {
        const me = row.userId === userId;
        const name = me ? "Tú" : (names.get(row.userId) ?? "Alguien");
        return { ...row, name, initial: me ? "T" : initialOf(name), me };
      }),
    ),
  };
};

export type LigaSummary = { place: number; points: number; ahead: { name: string; gap: number } | null; players: number } | null;

/** The portada's «tu lugar» (board Comp-2-portada): this week's place and the gap to the one above. */
export const ligaSummaryFor = async (userId: string, now = new Date()): Promise<LigaSummary> => {
  const { rows } = await loadLiga(userId, "semana", now);
  const index = rows.findIndex((row) => row.me);
  if (index < 0) return null;
  const mine = rows[index]!;
  const above = rows.slice(0, index).reverse().find((row) => row.points > mine.points) ?? null;
  return { place: mine.place, points: mine.points, ahead: above ? { name: above.name, gap: above.points - mine.points } : null, players: rows.length };
};
