import { createId } from "@paralleldrive/cuid2";
import { and, asc, desc, eq, isNotNull, isNull, max, sql } from "drizzle-orm";
import { db, juegoPartidas, juegoRondas, users } from "@/db";

/**
 * The partida engine of Extras (FIL-I52-1), shared by every competitive game: rounds that are the
 * same for everyone, partidas per person, records, the day table and the day streak. A game passes
 * its own id, lens and JSON; this file never reads `Catalog` and never writes `Title`.
 */

/** «reto» (FIL-I53): a partida played for a reto; its content carries `{ retoId, side }`. */
export type PartidaMode = "libre" | "diaria" | "reto";

export type PartidaRow = typeof juegoPartidas.$inferSelect;
export type RondaRow = typeof juegoRondas.$inferSelect;

/** Thrown when a person already has the daily of that game, lens and day. */
export class DailyTakenError extends Error {
  constructor() {
    super("Ya jugaste la diaria de hoy.");
    this.name = "DailyTakenError";
  }
}

const isUniqueViolation = (error: unknown) => {
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    if ((current as { code?: unknown }).code === "23505") return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
};

/**
 * The round of a day, made on first open: whoever comes first writes it with `build()`, everyone
 * after reads the same row (a race keeps the first insert).
 */
export const getOrCreateRonda = async <T>(input: {
  juego: string;
  lens: string;
  day: string;
  seed: string;
  build: () => Promise<T> | T;
}): Promise<RondaRow> => {
  const where = and(eq(juegoRondas.juego, input.juego), eq(juegoRondas.lens, input.lens), eq(juegoRondas.day, input.day));
  const existing = await db.query.juegoRondas.findFirst({ where });
  if (existing) return existing;
  const content = await input.build();
  await db
    .insert(juegoRondas)
    .values({ id: createId(), juego: input.juego, lens: input.lens, day: input.day, seed: input.seed, content })
    .onConflictDoNothing();
  const row = await db.query.juegoRondas.findFirst({ where });
  if (!row) throw new Error("No se pudo crear la ronda del día.");
  return row;
};

export const createPartida = async (input: {
  userId: string;
  juego: string;
  mode: PartidaMode;
  lens: string;
  content: unknown;
  day?: string | null;
  rondaId?: string | null;
  now?: Date;
}): Promise<PartidaRow> => {
  const now = input.now ?? new Date();
  const row = {
    id: createId(),
    userId: input.userId,
    juego: input.juego,
    mode: input.mode,
    lens: input.lens,
    day: input.day ?? null,
    rondaId: input.rondaId ?? null,
    content: input.content,
    answers: [],
    score: 0,
    startedAt: now,
    updatedAt: now,
  };
  try {
    await db.insert(juegoPartidas).values(row);
  } catch (error) {
    if (input.mode === "diaria" && isUniqueViolation(error)) throw new DailyTakenError();
    throw error;
  }
  return { ...row, finishedAt: null };
};

export const readPartida = (userId: string, partidaId: string) =>
  db.query.juegoPartidas.findFirst({ where: and(eq(juegoPartidas.id, partidaId), eq(juegoPartidas.userId, userId)) });

/** The person's daily of that game, lens and day, if they started it. */
export const readDailyPartida = (userId: string, juego: string, lens: string, day: string) =>
  db.query.juegoPartidas.findFirst({
    where: and(
      eq(juegoPartidas.userId, userId),
      eq(juegoPartidas.juego, juego),
      eq(juegoPartidas.lens, lens),
      eq(juegoPartidas.day, day),
      eq(juegoPartidas.mode, "diaria"),
    ),
  });

/** The free partida left unfinished (a network error, a closed tab), to pick it up again. */
export const readOpenFreePartida = (userId: string, juego: string, lens: string) =>
  db.query.juegoPartidas.findFirst({
    where: and(
      eq(juegoPartidas.userId, userId),
      eq(juegoPartidas.juego, juego),
      eq(juegoPartidas.lens, lens),
      eq(juegoPartidas.mode, "libre"),
      isNull(juegoPartidas.finishedAt),
    ),
    orderBy: [desc(juegoPartidas.startedAt)],
  });

/**
 * Appends one answer, only if nobody moved the partida in between (`expectedCount` answers so
 * far): a double tap or a retried request never counts twice. Returns false when it lost the race.
 */
export const recordAnswer = async (input: {
  partida: PartidaRow;
  answer: unknown;
  score: number;
  finished: boolean;
  now?: Date;
}): Promise<boolean> => {
  const now = input.now ?? new Date();
  const answers = [...(input.partida.answers as unknown[]), input.answer];
  const updated = await db
    .update(juegoPartidas)
    .set({ answers, score: input.score, updatedAt: now, finishedAt: input.finished ? now : null })
    .where(
      and(
        eq(juegoPartidas.id, input.partida.id),
        isNull(juegoPartidas.finishedAt),
        sql`jsonb_array_length(${juegoPartidas.answers}) = ${(input.partida.answers as unknown[]).length}`,
      ),
    )
    .returning({ id: juegoPartidas.id });
  return updated.length === 1;
};

/** Closes a partida with no more steps (or abandoned for a new one). */
export const finishPartida = async (partidaId: string, now = new Date()) => {
  await db
    .update(juegoPartidas)
    .set({ finishedAt: now, updatedAt: now })
    .where(and(eq(juegoPartidas.id, partidaId), isNull(juegoPartidas.finishedAt)));
};

/** The person's best score in a game, mode and lens (0 before the first one). */
export const bestScore = async (userId: string, juego: string, mode: PartidaMode, lens: string) => {
  const [row] = await db
    .select({ best: max(juegoPartidas.score) })
    .from(juegoPartidas)
    .where(
      and(eq(juegoPartidas.userId, userId), eq(juegoPartidas.juego, juego), eq(juegoPartidas.mode, mode), eq(juegoPartidas.lens, lens)),
    );
  return row?.best ?? 0;
};

/** Best free score per lens, for the lens picker. */
export const bestScoresByLens = async (userId: string, juego: string) => {
  const rows = await db
    .select({ lens: juegoPartidas.lens, best: max(juegoPartidas.score), played: sql<number>`count(*)::int` })
    .from(juegoPartidas)
    .where(and(eq(juegoPartidas.userId, userId), eq(juegoPartidas.juego, juego), eq(juegoPartidas.mode, "libre")))
    .groupBy(juegoPartidas.lens);
  return new Map(rows.map((row) => [row.lens, { best: row.best ?? 0, played: row.played }]));
};

/** `YYYY-MM-DD` of every finished daily of the person in a game, for the day streak. */
export const finishedDailyDays = async (userId: string, juego: string) => {
  const rows = await db
    .selectDistinct({ day: juegoPartidas.day })
    .from(juegoPartidas)
    .where(
      and(
        eq(juegoPartidas.userId, userId),
        eq(juegoPartidas.juego, juego),
        eq(juegoPartidas.mode, "diaria"),
        isNotNull(juegoPartidas.finishedAt),
      ),
    );
  return rows.flatMap((row) => (row.day ? [row.day] : []));
};

export type DayTableRow = {
  partidaId: string;
  userId: string;
  /** First name, or the initial when that is all there is; never the email. */
  name: string;
  initial: string;
  score: number;
  answers: unknown[];
  finished: boolean;
  /** 1-based; ties share a place. Null while unfinished. */
  place: number | null;
};

/** What a person may be called on a table: the first word of their name, never their email. */
export const displayNameOf = (name: string | null) => {
  const first = name?.trim().split(/\s+/)[0] ?? "";
  return first || "Alguien";
};

/** Pure: finished first by score (ties share the place, the earlier finish first), then the unfinished. */
export const rankDayTable = <T extends { score: number; finishedAt: Date | null }>(rows: readonly T[]) => {
  const done = rows
    .filter((row) => row.finishedAt)
    .sort((a, b) => b.score - a.score || a.finishedAt!.getTime() - b.finishedAt!.getTime());
  const open = rows.filter((row) => !row.finishedAt);
  let place = 0;
  let lastScore: number | null = null;
  const ranked = done.map((row, index) => {
    if (row.score !== lastScore) {
      place = index + 1;
      lastScore = row.score;
    }
    return { row, place: place as number | null };
  });
  return [...ranked, ...open.map((row) => ({ row, place: null }))];
};

/** The day table: every account that opened the daily, across all accounts (no groups). */
export const loadDayTable = async (juego: string, lens: string, day: string): Promise<DayTableRow[]> => {
  const rows = await db
    .select({
      partidaId: juegoPartidas.id,
      userId: juegoPartidas.userId,
      name: users.name,
      score: juegoPartidas.score,
      answers: juegoPartidas.answers,
      finishedAt: juegoPartidas.finishedAt,
    })
    .from(juegoPartidas)
    .innerJoin(users, eq(users.id, juegoPartidas.userId))
    .where(
      and(eq(juegoPartidas.juego, juego), eq(juegoPartidas.lens, lens), eq(juegoPartidas.day, day), eq(juegoPartidas.mode, "diaria")),
    )
    .orderBy(asc(juegoPartidas.startedAt));
  return rankDayTable(rows).map(({ row, place }) => {
    const name = displayNameOf(row.name);
    return {
      partidaId: row.partidaId,
      userId: row.userId,
      name,
      initial: name.slice(0, 1).toUpperCase(),
      score: row.score,
      answers: row.answers as unknown[],
      finished: row.finishedAt != null,
      place,
    };
  });
};

/** How many accounts finished a daily, for the portada («5 ya jugaron»). */
export const countDailyPlayers = async (juego: string, day: string) => {
  const [row] = await db
    .select({ count: sql<number>`count(distinct ${juegoPartidas.userId})::int` })
    .from(juegoPartidas)
    .where(
      and(eq(juegoPartidas.juego, juego), eq(juegoPartidas.day, day), eq(juegoPartidas.mode, "diaria"), isNotNull(juegoPartidas.finishedAt)),
    );
  return row?.count ?? 0;
};

/** Accounts that exist, to say how many have not played yet. */
export const countAccounts = async () => {
  const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(users).where(isNotNull(users.onboardedAt));
  return row?.count ?? 0;
};
