import { createId } from "@paralleldrive/cuid2";
import { alias } from "drizzle-orm/pg-core";
import { and, desc, eq, gt, inArray, isNotNull, isNull, lte, ne, or, sql } from "drizzle-orm";
import { db, juegoPartidas, juegoRetos, users } from "@/db";
import type { PartidaRow } from "@/lib/juegos/partidas";
import {
  expiresAtFrom,
  headToHead,
  headToHeadLine,
  initialOf,
  isRetoOpen,
  parseRetoJuego,
  RETO_JUEGOS,
  RETO_MAX_OPEN_TO_SAME,
  RETO_MS,
  retoNames,
  type HeadToHead,
  type RetoJuegoId,
} from "@/lib/juegos/retos/core";

/**
 * Retos on the database (FIL-I53-1): create, send, expire, list «Te toca», the people one can
 * challenge and the history between two. Each game keeps its own content; a partida played for a
 * reto carries `{ retoId, side }` in its content so finishing it settles the reto.
 */

export type RetoRow = typeof juegoRetos.$inferSelect;
export type RetoSide = "from" | "to";

/** What every reto partida's content carries, besides the game's own fields. */
export type RetoPartidaContent = { retoId: string; side: RetoSide };

export class RetoError extends Error {
  constructor(
    message: string,
    readonly code: "self" | "cap" | "target" | "partida" | "permiso" | "datos",
  ) {
    super(message);
    this.name = "RetoError";
  }
}

export const retoSideOf = (partida: Pick<PartidaRow, "content" | "mode">): RetoPartidaContent | null => {
  if (partida.mode !== "reto") return null;
  const content = partida.content as Partial<RetoPartidaContent> | null;
  return content?.retoId && (content.side === "from" || content.side === "to") ? { retoId: content.retoId, side: content.side } : null;
};

/**
 * Open retos whose 48 hours ran out become `vencido` (for both sides at once). Only the person's
 * own retos (sent or received): every list is someone's, and nothing else needs the sweep (the
 * metrics count an open reto past its time as expired anyway).
 */
export const expireRetos = async (userId: string, now = new Date()) => {
  await db
    .update(juegoRetos)
    .set({ status: "vencido" })
    .where(
      and(
        eq(juegoRetos.status, "abierto"),
        lte(juegoRetos.expiresAt, now),
        or(eq(juegoRetos.fromUserId, userId), eq(juegoRetos.toUserId, userId)),
      ),
    );
};

/** Open retos (sent or still being played by the sender) from one account toward another. */
export const countOpenToward = async (fromUserId: string, toUserId: string, now = new Date()) => {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(juegoRetos)
    .where(
      and(
        eq(juegoRetos.fromUserId, fromUserId),
        eq(juegoRetos.toUserId, toUserId),
        eq(juegoRetos.status, "abierto"),
        gt(juegoRetos.expiresAt, now),
      ),
    );
  return row?.count ?? 0;
};

const isChallengeable = async (userId: string) =>
  Boolean(await db.query.users.findFirst({ where: and(eq(users.id, userId), isNotNull(users.onboardedAt)), columns: { id: true } }));

/**
 * A new reto. `sent` means the sender's side is already played (a finished partida): the 48 hours
 * start now. Otherwise the sender plays first and `sendReto` starts them; meanwhile the reto still
 * counts toward the cap and expires 48 hours after it was made if never sent.
 */
export const createReto = async (input: {
  fromUserId: string;
  toUserId: string | null;
  juego: RetoJuegoId;
  lens: string;
  seed: string;
  content: unknown;
  fromPartidaId?: string | null;
  sent: boolean;
  linkTokenHash?: string | null;
  rematchOf?: string | null;
  now?: Date;
}): Promise<RetoRow> => {
  const now = input.now ?? new Date();
  if (input.toUserId) {
    if (input.toUserId === input.fromUserId) throw new RetoError("No puedes retarte a ti.", "self");
    if (!(await isChallengeable(input.toUserId))) throw new RetoError("Esa cuenta no existe.", "target");
    if ((await countOpenToward(input.fromUserId, input.toUserId, now)) >= RETO_MAX_OPEN_TO_SAME) {
      throw new RetoError(`Ya tienes ${RETO_MAX_OPEN_TO_SAME} retos abiertos con esa persona. Espera a que juegue.`, "cap");
    }
  }
  const row = {
    id: createId(),
    juego: input.juego,
    lens: input.lens,
    seed: input.seed,
    content: input.content,
    fromUserId: input.fromUserId,
    toUserId: input.toUserId,
    fromPartidaId: input.fromPartidaId ?? null,
    toPartidaId: null,
    linkTokenHash: input.linkTokenHash ?? null,
    linkResult: null,
    status: "abierto",
    rematchOf: input.rematchOf ?? null,
    createdAt: now,
    sentAt: input.sent ? now : null,
    expiresAt: expiresAtFrom(now),
    finishedAt: null,
  } satisfies RetoRow;
  await db.insert(juegoRetos).values(row);
  return row;
};

/** Ties the sender's partida to a reto made before playing (pick-first flow). */
export const setFromPartida = async (retoId: string, partidaId: string) => {
  await db.update(juegoRetos).set({ fromPartidaId: partidaId }).where(and(eq(juegoRetos.id, retoId), isNull(juegoRetos.fromPartidaId)));
};

/** The sender finished: the other person sees it from now, for 48 hours. Returns the row when this call sent it. */
export const sendReto = async (retoId: string, now = new Date()): Promise<RetoRow | null> => {
  const [row] = await db
    .update(juegoRetos)
    .set({ sentAt: now, expiresAt: expiresAtFrom(now) })
    .where(and(eq(juegoRetos.id, retoId), isNull(juegoRetos.sentAt), eq(juegoRetos.status, "abierto")))
    .returning();
  return row ?? null;
};

/** The receiver's partida; only the first one counts (a second tab gets the same one). */
export const claimToPartida = async (retoId: string, partidaId: string) => {
  const updated = await db
    .update(juegoRetos)
    .set({ toPartidaId: partidaId })
    .where(and(eq(juegoRetos.id, retoId), isNull(juegoRetos.toPartidaId)))
    .returning({ id: juegoRetos.id });
  return updated.length === 1;
};

/** The receiver finished: the reto is played. */
export const finishReto = async (retoId: string, now = new Date()) => {
  await db
    .update(juegoRetos)
    .set({ status: "jugado", finishedAt: now })
    .where(and(eq(juegoRetos.id, retoId), eq(juegoRetos.status, "abierto")));
};

/**
 * Called by a game when one of its partidas finishes: the sender's side sends the reto, the
 * receiver's side closes it. Returns the reto when it was just sent (the caller may push).
 */
export const settleRetoPartida = async (partida: PartidaRow, now = new Date()): Promise<RetoRow | null> => {
  const side = retoSideOf(partida);
  if (!side) return null;
  if (side.side === "from") return sendReto(side.retoId, now);
  await finishReto(side.retoId, now);
  return null;
};

export const readReto = (retoId: string) => db.query.juegoRetos.findFirst({ where: eq(juegoRetos.id, retoId) });

/** A reto the person is part of (sender or receiver), or null. */
export const readRetoFor = async (userId: string, retoId: string) => {
  const reto = await readReto(retoId);
  if (!reto || (reto.fromUserId !== userId && reto.toUserId !== userId)) return null;
  return reto;
};

// ---------------------------------------------------------------------------
// Lists
// ---------------------------------------------------------------------------

const fromPartida = alias(juegoPartidas, "fromPartida");
const toPartida = alias(juegoPartidas, "toPartida");

const scoreOfLink = (linkResult: unknown) => {
  const result = linkResult as { score?: unknown; finishedAt?: unknown } | null;
  return result && typeof result.score === "number" && result.finishedAt ? result.score : null;
};

/** Retos with both sides' scores (null while a side is not finished). */
const retosWithScores = (where: ReturnType<typeof and>) =>
  db
    .select({
      id: juegoRetos.id,
      juego: juegoRetos.juego,
      lens: juegoRetos.lens,
      fromUserId: juegoRetos.fromUserId,
      toUserId: juegoRetos.toUserId,
      status: juegoRetos.status,
      sentAt: juegoRetos.sentAt,
      expiresAt: juegoRetos.expiresAt,
      finishedAt: juegoRetos.finishedAt,
      createdAt: juegoRetos.createdAt,
      linkTokenHash: juegoRetos.linkTokenHash,
      linkResult: juegoRetos.linkResult,
      fromScore: sql<number | null>`case when ${fromPartida.finishedAt} is not null then ${fromPartida.score} end`,
      toScore: sql<number | null>`case when ${toPartida.finishedAt} is not null then ${toPartida.score} end`,
      toStarted: sql<boolean>`${toPartida.id} is not null`,
    })
    .from(juegoRetos)
    .leftJoin(fromPartida, eq(fromPartida.id, juegoRetos.fromPartidaId))
    .leftJoin(toPartida, eq(toPartida.id, juegoRetos.toPartidaId))
    .where(where);

export type RetoListRow = Awaited<ReturnType<typeof retosWithScores>>[number];

const namesOf = async (ids: readonly string[]) => {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map<string, string>();
  const rows = await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, unique));
  return retoNames(rows);
};

export type TeTocaItem = {
  retoId: string;
  juego: RetoJuegoId;
  fromName: string;
  initial: string;
  /** «Duelo de trivia · hizo 410». */
  line: string;
  expiresAt: Date;
  /** The receiver already opened it and left it half played. */
  started: boolean;
};

/** «Te toca»: retos sent to the person, open, within their 48 hours, not finished by them. Oldest first. */
export const listTeToca = async (userId: string, now = new Date()): Promise<TeTocaItem[]> => {
  await expireRetos(userId, now);
  const rows = await retosWithScores(
    and(eq(juegoRetos.toUserId, userId), eq(juegoRetos.status, "abierto"), isNotNull(juegoRetos.sentAt), gt(juegoRetos.expiresAt, now)),
  ).orderBy(juegoRetos.sentAt);
  const names = await namesOf(rows.map((row) => row.fromUserId));
  return rows.flatMap((row) => {
    const juego = parseRetoJuego(row.juego);
    if (!juego) return [];
    const fromName = names.get(row.fromUserId) ?? "Alguien";
    return [
      {
        retoId: row.id,
        juego,
        fromName,
        initial: initialOf(fromName),
        line: `${RETO_JUEGOS[juego].name} · ${RETO_JUEGOS[juego].unit(row.fromScore ?? 0)}`,
        expiresAt: row.expiresAt,
        started: row.toStarted,
      },
    ];
  });
};

/** Every reto between two accounts, both directions. */
export const retosBetween = (a: string, b: string) =>
  retosWithScores(
    or(and(eq(juegoRetos.fromUserId, a), eq(juegoRetos.toUserId, b)), and(eq(juegoRetos.fromUserId, b), eq(juegoRetos.toUserId, a))),
  ).orderBy(desc(juegoRetos.createdAt));

/** The history between two accounts from `me`'s side: finished retos only. */
export const loadHeadToHead = async (me: string, other: string): Promise<HeadToHead> => headToHead(await retosBetween(me, other), me);

export type Retable = {
  userId: string;
  name: string;
  initial: string;
  /** «Van 3 a 2 a tu favor» or «Nunca han jugado». */
  line: string;
  /** Already at the cap of open retos toward this person. */
  full: boolean;
};

/**
 * The people one can challenge: every other onboarded account (one pool, no groups). Only `id`
 * and `name` are read: an email never leaves the database. `filter` narrows (Duelo de gustos).
 */
export const listRetables = async (userId: string, now = new Date(), filter?: (ids: string[]) => Promise<Set<string>>): Promise<Retable[]> => {
  await expireRetos(userId, now);
  const people = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(and(isNotNull(users.onboardedAt), ne(users.id, userId)));
  const allowed = filter ? await filter(people.map((person) => person.id)) : null;
  const names = retoNames(people);
  const mine = await retosWithScores(or(eq(juegoRetos.fromUserId, userId), eq(juegoRetos.toUserId, userId)));
  const out = people
    .filter((person) => !allowed || allowed.has(person.id))
    .map((person) => {
      const between = mine.filter((row) => row.fromUserId === person.id || row.toUserId === person.id);
      const h2h = headToHead(between, userId);
      const open = between.filter((row) => row.fromUserId === userId && isRetoOpen(row, now)).length;
      const name = names.get(person.id) ?? "Alguien";
      return {
        userId: person.id,
        name,
        initial: initialOf(name),
        line: headToHeadLine(h2h),
        full: open >= RETO_MAX_OPEN_TO_SAME,
        lastAt: between[0]?.createdAt.getTime() ?? 0,
      };
    });
  // People played with recently first, then by name.
  return out
    .sort((a, b) => b.lastAt - a.lastAt || a.name.localeCompare(b.name, "es"))
    .map((row) => ({ userId: row.userId, name: row.name, initial: row.initial, line: row.line, full: row.full }));
};

export type MyRetoItem = {
  retoId: string;
  juego: RetoJuegoId;
  /** The other person, or «Enlace» for a link reto. */
  otherName: string;
  initial: string;
  mine: "from" | "to";
  state: "esperando" | "te-toca" | "ganaste" | "perdiste" | "empate" | "jugando";
  line: string;
};

/** The person's latest retos for Duelos: open ones and the finished ones (expired ones are gone). */
export const listMyRetos = async (userId: string, now = new Date(), limit = 12): Promise<MyRetoItem[]> => {
  await expireRetos(userId, now);
  const rows = await retosWithScores(
    and(
      or(eq(juegoRetos.fromUserId, userId), eq(juegoRetos.toUserId, userId)),
      or(eq(juegoRetos.status, "jugado"), and(eq(juegoRetos.status, "abierto"), gt(juegoRetos.expiresAt, now))),
    ),
  )
    .orderBy(desc(juegoRetos.createdAt))
    .limit(limit);
  const names = await namesOf(rows.flatMap((row) => [row.fromUserId, ...(row.toUserId ? [row.toUserId] : [])]));
  return rows.flatMap((row): MyRetoItem[] => {
    const juego = parseRetoJuego(row.juego);
    if (!juego) return [];
    const mine = row.fromUserId === userId ? "from" : "to";
    // A reto the receiver has not seen yet is invisible to them until it is sent.
    if (mine === "to" && !row.sentAt) return [];
    const otherId = mine === "from" ? row.toUserId : row.fromUserId;
    const otherName = otherId ? (names.get(otherId) ?? "Alguien") : "Enlace";
    const toScore = row.toUserId ? row.toScore : scoreOfLink(row.linkResult);
    let state: MyRetoItem["state"];
    let line: string;
    if (row.status === "jugado" && row.fromScore != null && toScore != null) {
      const myScore = mine === "from" ? row.fromScore : toScore;
      const theirs = mine === "from" ? toScore : row.fromScore;
      state = myScore === theirs ? "empate" : myScore > theirs ? "ganaste" : "perdiste";
      line = `${myScore} a ${theirs}`;
    } else if (mine === "from" && !row.sentAt) {
      state = "jugando";
      line = "Te falta terminar tu parte";
    } else if (mine === "from") {
      state = "esperando";
      line = "Esperando a que juegue";
    } else {
      state = "te-toca";
      line = "Te toca";
    }
    return [{ retoId: row.id, juego, otherName, initial: initialOf(otherName), mine, state, line }];
  });
};

/** A link reto with a finished guest result counts as played (FIL-I53-4). */
export const finishLinkReto = async (retoId: string, linkResult: unknown, expectedAnswers: number, now = new Date()) => {
  const finished = (linkResult as { finishedAt?: unknown }).finishedAt != null;
  const updated = await db
    .update(juegoRetos)
    .set({ linkResult, ...(finished ? { status: "jugado", finishedAt: now } : {}) })
    .where(
      and(
        eq(juegoRetos.id, retoId),
        eq(juegoRetos.status, "abierto"),
        gt(juegoRetos.expiresAt, now),
        sql`coalesce(jsonb_array_length(${juegoRetos.linkResult}->'answers'), 0) = ${expectedAnswers}`,
      ),
    )
    .returning({ id: juegoRetos.id });
  return updated.length === 1;
};

export { RETO_MS };
