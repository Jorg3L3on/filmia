import { and, eq, gte } from "drizzle-orm";
import { catalog, db, juegoRondas } from "@/db";
import { addDays, mxToday } from "@/lib/cine-core";
import { DIARIA_LENS, DIARIA_NO_REPEAT_DAYS, diariaSeed, type DiariaId } from "@/lib/juegos/diarias/core";
import { dayStreak } from "@/lib/juegos/mayor/core";
import {
  countAccounts,
  createPartida,
  DailyTakenError,
  finishedDailyDays,
  getOrCreateRonda,
  loadDayTable,
  readDailyPartida,
  readPartida,
  recordAnswer,
  type DayTableRow,
  type PartidaRow,
} from "@/lib/juegos/partidas";

/**
 * The database side every FIL-I54 daily shares: open today's round and the person's partida,
 * append an answer with the engine's race guard, and read the day table. A game passes its own
 * `build` and keeps its own content; nothing here reads `Title` or writes it.
 */

/** Thrown by a game's `build` when there are not enough films for today's round. */
export class ShortPoolError extends Error {
  constructor() {
    super("No hay suficientes películas para la diaria de hoy.");
    this.name = "ShortPoolError";
  }
}

export type OpenedDiaria = { status: "ok"; partida: PartidaRow } | { status: "unavailable"; day: string };

/**
 * Today's partida (Mexico City): the round is made on the first open of the day and is the same
 * for every account; the person's partida copies it once and is never made again that day.
 */
export const openDiaria = async <T>(input: {
  userId: string;
  juego: DiariaId;
  now?: Date;
  build: (seed: string, day: string) => Promise<T> | T;
}): Promise<OpenedDiaria> => {
  const now = input.now ?? new Date();
  const day = mxToday(now);
  const existing = await readDailyPartida(input.userId, input.juego, DIARIA_LENS, day);
  if (existing) return { status: "ok", partida: existing };
  const seed = diariaSeed(input.juego, day);
  let ronda;
  try {
    ronda = await getOrCreateRonda({ juego: input.juego, lens: DIARIA_LENS, day, seed, build: () => input.build(seed, day) });
  } catch (error) {
    if (error instanceof ShortPoolError) return { status: "unavailable", day };
    throw error;
  }
  try {
    const partida = await createPartida({
      userId: input.userId,
      juego: input.juego,
      mode: "diaria",
      lens: DIARIA_LENS,
      day,
      rondaId: ronda.id,
      content: ronda.content,
      now,
    });
    return { status: "ok", partida };
  } catch (error) {
    // Two tabs opening at once: the other one won, show it.
    if (!(error instanceof DailyTakenError)) throw error;
    const partida = await readDailyPartida(input.userId, input.juego, DIARIA_LENS, day);
    if (!partida) throw error;
    return { status: "ok", partida };
  }
};

/** The person's daily of `day` if they started it (no new round, no new partida). */
export const readDiaria = (userId: string, juego: DiariaId, day: string) => readDailyPartida(userId, juego, DIARIA_LENS, day);

/** The person's own partida of that game, or null (someone else's is null too). */
export const readOwnPartida = async (userId: string, juego: DiariaId, partidaId: string) => {
  if (typeof partidaId !== "string" || !partidaId) return null;
  const partida = await readPartida(userId, partidaId);
  return partida && partida.juego === juego && partida.mode === "diaria" ? partida : null;
};

export type AppendOutcome = { stored: true; partida: PartidaRow } | { stored: false; partida: PartidaRow };

/** Appends one answer (the engine's guard: a double tap or a retried request never counts twice). */
export const appendAnswer = async (input: { userId: string; partida: PartidaRow; answer: unknown; score: number; finished: boolean; now?: Date }): Promise<AppendOutcome> => {
  const stored = await recordAnswer({ partida: input.partida, answer: input.answer, score: input.score, finished: input.finished, now: input.now });
  const fresh = (await readPartida(input.userId, input.partida.id)) ?? input.partida;
  return { stored, partida: fresh };
};

/** Catalog ids the game's rounds of the last `DIARIA_NO_REPEAT_DAYS` used, so a film does not come back soon. */
export const recentRoundContents = async (juego: DiariaId, day: string) => {
  const rows = await db
    .select({ content: juegoRondas.content })
    .from(juegoRondas)
    .where(and(eq(juegoRondas.juego, juego), gte(juegoRondas.day, addDays(day, -DIARIA_NO_REPEAT_DAYS))));
  return rows.map((row) => row.content);
};

/** Every string value under `key` anywhere in some JSON, e.g. all `catalogId`s of past rounds. */
export const collectStrings = (values: readonly unknown[], key: string) => {
  const out = new Set<string>();
  const walk = (value: unknown) => {
    if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === "object") {
      for (const [name, inner] of Object.entries(value)) {
        if (name === key && typeof inner === "string") out.add(inner);
        else walk(inner);
      }
    }
  };
  values.forEach(walk);
  return out;
};

export type DiariaTable = {
  /** Everyone who opened today's daily, finished first by score; the person's row has `me`. */
  table: Array<DayTableRow & { me: boolean }>;
  /** Days in a row with a finished daily of this game, today included. */
  streak: number;
  /** Accounts that have not opened today's daily (a count, never names). */
  notYet: number;
};

/** The day table, the person's streak and how many have not played. Database only. */
export const loadDiariaTable = async (userId: string, juego: DiariaId, day: string, now = new Date()): Promise<DiariaTable> => {
  const [rows, days, accounts] = await Promise.all([loadDayTable(juego, DIARIA_LENS, day), finishedDailyDays(userId, juego), countAccounts()]);
  return {
    table: rows.map((row) => ({ ...row, me: row.userId === userId })),
    streak: dayStreak(days, mxToday(now)),
    notYet: Math.max(0, accounts - rows.length),
  };
};

/** The columns a daily reads of a well-known film. */
export const FILM_COLUMNS = {
  id: catalog.id,
  tmdbId: catalog.tmdbId,
  name: catalog.name,
  year: catalog.year,
  posterPath: catalog.posterPath,
  imdbVotes: catalog.imdbVotes,
};
