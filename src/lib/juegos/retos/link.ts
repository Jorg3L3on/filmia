import { createHash, randomBytes } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { catalog, db, juegoPartidas, juegoRetos, users } from "@/db";
import {
  isMayorGuess,
  MAYOR_LENSES,
  stepIds,
  stepsOf,
  truthOf,
  type MayorCandidate,
  type MayorGuess,
  type MayorLensId,
} from "@/lib/juegos/mayor/core";
import type { MayorCard, MayorStep, MayorView } from "@/lib/juegos/mayor/store";
import { firstNameOf, isRetoOpen, retoLinkPath } from "@/lib/juegos/retos/core";
import { mayorRetoSequence, retoFromFreeMayor } from "@/lib/juegos/retos/mayor";
import { finishLinkReto, type RetoRow } from "@/lib/juegos/retos/store";

/**
 * Reto por enlace (FIL-I53-4), Mayor o menor only: a link with a token nobody can guess lets a
 * person without an account play the sender's sequence. Nothing personal is kept: only the
 * answers, tied to the token. The token works for 48 hours; the table keeps its sha256, never the
 * token. The guest sees the sender's first name and nothing else about them.
 */

export const hashRetoToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** 32 random bytes in base64url: 43 characters. */
export const newRetoToken = () => randomBytes(32).toString("base64url");

const TOKEN_SHAPE = /^[A-Za-z0-9_-]{43}$/;

/** «Mandar un enlace» after a free streak: the link to share. */
export const createLinkReto = async (userId: string, partidaId: string, now = new Date()) => {
  const token = newRetoToken();
  const reto = await retoFromFreeMayor({ userId, partidaId, toUserId: null, linkTokenHash: hashRetoToken(token), now });
  return { reto, token, path: retoLinkPath(token) };
};

type LinkResult = { answers: boolean[]; score: number; finishedAt: string | null };

const resultOf = (reto: RetoRow): LinkResult => {
  const raw = reto.linkResult as Partial<LinkResult> | null;
  return {
    answers: Array.isArray(raw?.answers) ? raw.answers.map((answer) => answer === true) : [],
    score: typeof raw?.score === "number" ? raw.score : 0,
    finishedAt: typeof raw?.finishedAt === "string" ? raw.finishedAt : null,
  };
};

const lensOf = (reto: RetoRow): MayorLensId => (MAYOR_LENSES[reto.lens as MayorLensId] ? (reto.lens as MayorLensId) : "imdb");

const loadFilms = async (ids: readonly string[]) => {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map<string, MayorCandidate>();
  const rows = await db
    .select({
      id: catalog.id,
      name: catalog.name,
      posterPath: catalog.posterPath,
      imdbRating: catalog.imdbRating,
      imdbVotes: catalog.imdbVotes,
      year: catalog.year,
      runtimeMinutes: catalog.runtimeMinutes,
      rtScore: catalog.rtScore,
    })
    .from(catalog)
    .where(inArray(catalog.id, unique));
  return new Map(rows.map((row) => [row.id, row]));
};

const card = (film: MayorCandidate | undefined, id: string): MayorCard => ({ catalogId: id, name: film?.name ?? "Película", posterPath: film?.posterPath ?? null });

/** The link reto behind a token, while it is valid: an unknown, expired or cancelled token is null (404). */
const readLinkReto = async (token: string, now: Date) => {
  if (!TOKEN_SHAPE.test(token)) return null;
  const reto = await db.query.juegoRetos.findFirst({ where: eq(juegoRetos.linkTokenHash, hashRetoToken(token)) });
  if (!reto || reto.juego !== "mayor" || reto.toUserId) return null;
  // Valid for 48 hours from sending, played or not.
  if (reto.expiresAt.getTime() <= now.getTime() || reto.status === "vencido" || reto.status === "cancelado") return null;
  return reto;
};

export type LinkRetoView = {
  /** The sender's first name, never more. */
  fromName: string;
  fromScore: number;
  lens: MayorLensId;
  step: MayorStep | null;
  answers: boolean[];
  score: number;
  total: number;
  finished: boolean;
  expiresAt: Date;
};

const viewOf = async (reto: RetoRow): Promise<LinkRetoView> => {
  const lens = lensOf(reto);
  const sequence = mayorRetoSequence(reto);
  const result = resultOf(reto);
  const total = stepsOf(sequence, lens);
  const finished = result.finishedAt != null || reto.status === "jugado" || result.answers.length >= total;
  const ids = finished ? null : stepIds(sequence, lens, result.answers.length);
  const films = await loadFilms(ids ?? []);
  let step: MayorStep | null = null;
  if (ids) {
    const left = films.get(ids[0]);
    const value = left ? MAYOR_LENSES[lens].leftValue(left) : null;
    step = {
      index: result.answers.length,
      left: { ...card(left, ids[0]), value: value == null ? "—" : MAYOR_LENSES[lens].format(value) },
      right: card(films.get(ids[1]), ids[1]),
    };
  }
  const [sender, fromPartida] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, reto.fromUserId), columns: { name: true } }),
    reto.fromPartidaId ? db.query.juegoPartidas.findFirst({ where: eq(juegoPartidas.id, reto.fromPartidaId), columns: { score: true } }) : null,
  ]);
  return {
    fromName: firstNameOf(sender?.name ?? null),
    fromScore: fromPartida?.score ?? 0,
    lens,
    step,
    answers: result.answers,
    score: result.score,
    total,
    finished,
    expiresAt: reto.expiresAt,
  };
};

/** What the public page shows for a token, or null (the page answers 404). */
export const loadLinkReto = async (token: string, now = new Date()) => {
  const reto = await readLinkReto(token, now);
  return reto ? viewOf(reto) : null;
};

export type LinkAnswerOutcome =
  | { ok: true; correct: boolean; revealed: string; view: LinkRetoView }
  | { ok: false; error: string; view?: LinkRetoView };

/** One answer on the link: judged on the server, the hidden value revealed only after. First miss ends it. */
export const answerLinkReto = async (token: string, index: number, guess: MayorGuess, now = new Date()): Promise<LinkAnswerOutcome> => {
  if (!isMayorGuess(guess) || !Number.isInteger(index) || index < 0) return { ok: false, error: "Respuesta no válida." };
  const reto = await readLinkReto(token, now);
  if (!reto) return { ok: false, error: "Este reto ya no está disponible." };
  const result = resultOf(reto);
  if (!isRetoOpen(reto, now) || result.finishedAt || index !== result.answers.length) {
    return { ok: false, error: "Esa ya la contestaste.", view: await viewOf(reto) };
  }
  const lens = lensOf(reto);
  const sequence = mayorRetoSequence(reto);
  const ids = stepIds(sequence, lens, index);
  if (!ids) return { ok: false, error: "Ese reto ya terminó.", view: await viewOf(reto) };
  const films = await loadFilms(ids);
  const left = films.get(ids[0]);
  const right = films.get(ids[1]);
  if (!left || !right) return { ok: false, error: "No encontramos esas películas.", view: await viewOf(reto) };
  const truth = truthOf(lens, left, right);
  const correct = truth == null || truth === guess;
  const answers = [...result.answers, correct];
  const finished = !correct || answers.length >= stepsOf(sequence, lens);
  const next: LinkResult = { answers, score: result.score + (correct ? 1 : 0), finishedAt: finished ? now.toISOString() : null };
  const stored = await finishLinkReto(reto.id, next, result.answers.length, now);
  const fresh = (await db.query.juegoRetos.findFirst({ where: eq(juegoRetos.id, reto.id) }))!;
  if (!stored) return { ok: false, error: "Esa ya la contestaste.", view: await viewOf(fresh) };
  const value = MAYOR_LENSES[lens].rightValue(right);
  return { ok: true, correct, revealed: value == null ? "—" : MAYOR_LENSES[lens].format(value), view: await viewOf(fresh) };
};

/** The link's view in the shape Mayor o menor's screen plays (the guest has no partida: the id is a placeholder). */
export const linkAsMayorView = (view: LinkRetoView): MayorView => ({
  partidaId: "enlace",
  mode: "reto",
  lens: view.lens,
  day: null,
  step: view.step,
  answers: view.answers,
  score: view.score,
  total: view.total,
  finished: view.finished,
  best: 0,
});

/** Whether `userId` sent the link behind `token` (the sender sees their link, they do not play it). */
export const isLinkSender = async (token: string, userId: string, now = new Date()) => {
  const reto = await readLinkReto(token, now);
  return reto?.fromUserId === userId ? reto.id : null;
};
