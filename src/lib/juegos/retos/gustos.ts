import { createId } from "@paralleldrive/cuid2";
import { and, eq, inArray, isNotNull, or } from "drizzle-orm";
import { catalog, db, juegoPartidas, juegoRetos, titles, users } from "@/db";
import { createPartida, readPartida, recordAnswer, type PartidaRow } from "@/lib/juegos/partidas";
import { firstNameOf } from "@/lib/juegos/retos/core";
import {
  buildGustosPairs,
  GUSTOS_ID,
  GUSTOS_MIN_RATED,
  gustosMissingLine,
  gustosWinner,
  type GustosPair,
  type GustosRated,
} from "@/lib/juegos/retos/gustos-core";
import { claimToPartida, createReto, readReto, RetoError, setFromPartida, type RetoRow, type RetoSide } from "@/lib/juegos/retos/store";

/**
 * Duelo de gustos on the database (FIL-I53-6). Only between two people who both turned on «Usar mis
 * notas en juegos»; each guesses the other's preferences over seven pairs. The ratings travel to
 * the client only for a pair already answered; turning the switch off cancels open duels.
 */

type GustosRetoContent = {
  /** Pairs the sender answers: the receiver's ratings. */
  forFrom: GustosPair[];
  /** Pairs the receiver answers: the sender's ratings. */
  forTo: GustosPair[];
};

type GustosPartidaContent = { retoId: string; side: RetoSide; pairs: GustosPair[] };

export type GustosAnswer = { pick: string; correct: boolean };

/** The person's own ratings (never `impliedRating`). */
export const loadOwnRatings = async (userId: string): Promise<GustosRated[]> => {
  const rows = await db
    .select({ catalogId: titles.catalogId, rating: titles.rating })
    .from(titles)
    .where(and(eq(titles.userId, userId), isNotNull(titles.rating)));
  return rows.flatMap((row) => (row.rating == null ? [] : [{ catalogId: row.catalogId, rating: row.rating }]));
};

export type GustosReadiness = { notas: boolean; rated: number; missing: string | null };

export const gustosReadiness = async (userId: string): Promise<GustosReadiness> => {
  const [person, rated] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, userId), columns: { juegosNotas: true } }),
    loadOwnRatings(userId),
  ]);
  return { notas: person?.juegosNotas ?? false, rated: rated.length, missing: gustosMissingLine(rated.length, "tú") };
};

/** Of `ids`, who can be challenged to Duelo de gustos: the switch on and enough own ratings. */
export const gustosEligible = async (ids: readonly string[]) => {
  if (ids.length === 0) return new Set<string>();
  const on = await db.select({ id: users.id }).from(users).where(and(inArray(users.id, [...ids]), eq(users.juegosNotas, true)));
  const out = new Set<string>();
  for (const { id } of on) if ((await loadOwnRatings(id)).length >= GUSTOS_MIN_RATED) out.add(id);
  return out;
};

const createGustosPartida = (userId: string, retoId: string, side: RetoSide, pairs: GustosPair[], now: Date) =>
  createPartida({ userId, juego: GUSTOS_ID, mode: "reto", lens: "gustos", content: { retoId, side, pairs } satisfies GustosPartidaContent, now });

/**
 * A new Duelo de gustos. Both people must have the switch on, and both need seven pairs of their
 * own ratings; otherwise it is refused and nothing is written.
 */
export const startGustosReto = async (input: { userId: string; toUserId: string; rematchOf?: string | null; now?: Date }) => {
  const now = input.now ?? new Date();
  if (input.toUserId === input.userId) throw new RetoError("No puedes retarte a ti.", "self");
  const people = await db
    .select({ id: users.id, name: users.name, juegosNotas: users.juegosNotas })
    .from(users)
    .where(inArray(users.id, [input.userId, input.toUserId]));
  const me = people.find((person) => person.id === input.userId);
  const them = people.find((person) => person.id === input.toUserId);
  if (!me?.juegosNotas) throw new RetoError("Para este duelo, primero permite usar tus notas en juegos (en Perfil).", "permiso");
  if (!them?.juegosNotas) throw new RetoError("Esa persona no permite usar sus notas en juegos.", "permiso");
  const seed = createId();
  const forFrom = buildGustosPairs(await loadOwnRatings(input.toUserId), `${seed}|to`);
  const forTo = buildGustosPairs(await loadOwnRatings(input.userId), `${seed}|from`);
  if (!forTo) throw new RetoError(gustosMissingLine((await loadOwnRatings(input.userId)).length, "tú") ?? "Tus notas están muy parejas: califica películas más distintas.", "datos");
  if (!forFrom) {
    throw new RetoError(
      gustosMissingLine((await loadOwnRatings(input.toUserId)).length, firstNameOf(them.name)) ?? "Sus notas están muy parejas para armar el duelo.",
      "datos",
    );
  }
  const reto = await createReto({
    fromUserId: input.userId,
    toUserId: input.toUserId,
    juego: "gustos",
    lens: "gustos",
    seed,
    content: { forFrom, forTo } satisfies GustosRetoContent,
    sent: false,
    rematchOf: input.rematchOf ?? null,
    now,
  });
  const partida = await createGustosPartida(input.userId, reto.id, "from", forFrom, now);
  await setFromPartida(reto.id, partida.id);
  return { ...reto, fromPartidaId: partida.id };
};

export type GustosCard = { catalogId: string; name: string; posterPath: string | null };

export type GustosView = {
  partidaId: string;
  retoId: string;
  index: number;
  total: number;
  /** The pair to answer: two films, never their ratings. */
  pair: { a: GustosCard; b: GustosCard } | null;
  /** Answered pairs, now with both ratings of the other person. */
  answered: Array<GustosAnswer & { a: GustosCard; b: GustosCard; ra: number; rb: number }>;
  score: number;
  finished: boolean;
  /** The duel was cancelled (someone turned off their notes): nothing more to answer. */
  cancelled: boolean;
};

const pairsOf = (partida: PartidaRow) => (partida.content as GustosPartidaContent).pairs;
const answersOf = (partida: PartidaRow) => partida.answers as GustosAnswer[];

const loadCards = async (ids: readonly string[]) => {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map<string, GustosCard>();
  const rows = await db.select({ catalogId: catalog.id, name: catalog.name, posterPath: catalog.posterPath }).from(catalog).where(inArray(catalog.id, unique));
  return new Map(rows.map((row) => [row.catalogId, row]));
};

const cardOf = (cards: Map<string, GustosCard>, id: string): GustosCard => cards.get(id) ?? { catalogId: id, name: "Película", posterPath: null };

const viewOf = async (partida: PartidaRow, cancelled: boolean): Promise<GustosView> => {
  const pairs = pairsOf(partida);
  const answers = answersOf(partida);
  const index = answers.length;
  const finished = partida.finishedAt != null || index >= pairs.length;
  const current = !finished && !cancelled ? pairs[index] : undefined;
  const cards = await loadCards([...pairs.slice(0, index + 1).flatMap((pair) => [pair.a, pair.b])]);
  return {
    partidaId: partida.id,
    retoId: (partida.content as GustosPartidaContent).retoId,
    index,
    total: pairs.length,
    pair: current ? { a: cardOf(cards, current.a), b: cardOf(cards, current.b) } : null,
    answered: answers.map((answer, position) => {
      const pair = pairs[position]!;
      return { ...answer, a: cardOf(cards, pair.a), b: cardOf(cards, pair.b), ra: pair.ra, rb: pair.rb };
    }),
    score: partida.score,
    finished,
    cancelled,
  };
};

const readGustos = async (userId: string, partidaId: string) => {
  const partida = await readPartida(userId, partidaId);
  return partida && partida.juego === GUSTOS_ID ? partida : null;
};

const isCancelled = async (retoId: string) => (await readReto(retoId))?.status === "cancelado";

export const viewGustosPartida = async (userId: string, partidaId: string) => {
  const partida = await readGustos(userId, partidaId);
  return partida ? viewOf(partida, await isCancelled((partida.content as GustosPartidaContent).retoId)) : null;
};

export const openGustosSide = async (userId: string, reto: RetoRow, now = new Date()): Promise<GustosView | null> => {
  if (reto.fromUserId === userId) return reto.fromPartidaId ? viewGustosPartida(userId, reto.fromPartidaId) : null;
  if (reto.toUserId !== userId) return null;
  if (reto.toPartidaId) return viewGustosPartida(userId, reto.toPartidaId);
  if (reto.status === "cancelado") return null;
  const partida = await createGustosPartida(userId, reto.id, "to", (reto.content as GustosRetoContent).forTo, now);
  if (await claimToPartida(reto.id, partida.id)) return viewOf(partida, false);
  const fresh = await readReto(reto.id);
  return fresh?.toPartidaId ? viewGustosPartida(userId, fresh.toPartidaId) : null;
};

export type GustosAnswerOutcome =
  | { ok: true; correct: boolean; ra: number; rb: number; view: GustosView }
  | { ok: false; error: string; view?: GustosView };

/** Judges pair `index`: right when the pick is the film the other person rated higher. */
export const answerGustos = async (userId: string, partidaId: string, index: number, pick: string, now = new Date()): Promise<GustosAnswerOutcome> => {
  const partida = await readGustos(userId, partidaId);
  if (!partida) return { ok: false, error: "No encontramos ese duelo." };
  const retoId = (partida.content as GustosPartidaContent).retoId;
  if (await isCancelled(retoId)) return { ok: false, error: "Este duelo se canceló: alguien dejó de compartir sus notas.", view: await viewOf(partida, true) };
  const pairs = pairsOf(partida);
  const answers = answersOf(partida);
  if (partida.finishedAt || index !== answers.length) return { ok: false, error: "Ese par ya lo contestaste.", view: await viewOf(partida, false) };
  const pair = pairs[index];
  if (!pair || (pick !== pair.a && pick !== pair.b)) return { ok: false, error: "Elige una de las dos.", view: await viewOf(partida, false) };
  const correct = pick === gustosWinner(pair);
  const stored = await recordAnswer({
    partida,
    answer: { pick, correct } satisfies GustosAnswer,
    score: partida.score + (correct ? 1 : 0),
    finished: index + 1 >= pairs.length,
    now,
  });
  const fresh = (await readGustos(userId, partidaId))!;
  if (!stored) return { ok: false, error: "Ese par ya lo contestaste.", view: await viewOf(fresh, false) };
  return { ok: true, correct, ra: pair.ra, rb: pair.rb, view: await viewOf(fresh, false) };
};

/** The other side's answers, for the closing screen («Ana adivinándote a ti»). */
export const gustosAnswersOf = async (partidaId: string | null) => {
  if (!partidaId) return [];
  const partida = await db.query.juegoPartidas.findFirst({ where: eq(juegoPartidas.id, partidaId) });
  return partida ? answersOf(partida) : [];
};

/** Perfil «Usar mis notas en juegos». Turning it off cancels every open duel that uses those notes. */
export const setJuegosNotasFor = async (userId: string, enabled: boolean, now = new Date()) => {
  await db.update(users).set({ juegosNotas: enabled }).where(eq(users.id, userId));
  if (enabled) return 0;
  const cancelled = await db
    .update(juegoRetos)
    .set({ status: "cancelado", finishedAt: now })
    .where(
      and(
        eq(juegoRetos.juego, "gustos"),
        eq(juegoRetos.status, "abierto"),
        or(eq(juegoRetos.fromUserId, userId), eq(juegoRetos.toUserId, userId)),
      ),
    )
    .returning({ id: juegoRetos.id });
  return cancelled.length;
};

export const loadJuegosNotas = async (userId: string) =>
  (await db.query.users.findFirst({ where: eq(users.id, userId), columns: { juegosNotas: true } }))?.juegosNotas ?? false;
