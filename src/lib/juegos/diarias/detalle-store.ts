import { and, eq, gte, inArray, isNotNull } from "drizzle-orm";
import { catalog, db } from "@/db";
import { DIARIA_MIN_VOTES, diariaNumber, type TitleGuess } from "@/lib/juegos/diarias/core";
import {
  buildDetalleRound,
  cropAllowed,
  DETALLE_ID,
  DETALLE_MAX,
  detalleState,
  parseDetalleAnswers,
  type DetalleAnswer,
  type DetalleCandidate,
  type DetalleRound,
} from "@/lib/juegos/diarias/detalle";
import { appendAnswer, collectStrings, openDiaria, readOwnPartida, recentRoundContents, ShortPoolError } from "@/lib/juegos/diarias/store";
import type { PartidaRow } from "@/lib/juegos/partidas";

/**
 * Detalle on the database (FIL-I54-1). The server keeps the round and judges every guess; a view
 * sent to the client says which crop to ask for, never the poster path or the film, until that
 * poster is solved or failed.
 */

export type DetalleSources = { pool: () => Promise<DetalleCandidate[]> };

export const loadDetallePool = (): Promise<DetalleCandidate[]> =>
  db
    .select({ id: catalog.id, tmdbId: catalog.tmdbId, posterPath: catalog.posterPath, imdbVotes: catalog.imdbVotes })
    .from(catalog)
    .where(and(eq(catalog.kind, "MOVIE"), isNotNull(catalog.posterPath), gte(catalog.imdbVotes, DIARIA_MIN_VOTES)));

const defaultSources: DetalleSources = { pool: loadDetallePool };

/** What the client gets about one poster. */
export type DetallePosterView = {
  index: number;
  status: "pending" | "playing" | "solved" | "failed";
  level: number;
  points: number;
  misses: string[];
  /** Only once solved or failed. */
  reveal: { name: string; year: number | null; posterPath: string | null } | null;
};

export type DetalleView = {
  partidaId: string;
  day: string;
  number: number;
  /** Answers so far: the client sends it back so a retried tap never counts twice. */
  step: number;
  posters: DetallePosterView[];
  current: number | null;
  score: number;
  total: number;
  finished: boolean;
};

const roundOf = (partida: PartidaRow) => partida.content as DetalleRound;

const viewOf = async (partida: PartidaRow): Promise<DetalleView> => {
  const round = roundOf(partida);
  const state = detalleState(parseDetalleAnswers(partida.answers as unknown[]), round.posters.length);
  const revealedIds = round.posters.filter((_, index) => ["solved", "failed"].includes(state.posters[index]!.status)).map((poster) => poster.catalogId);
  const films = revealedIds.length
    ? await db.select({ id: catalog.id, name: catalog.name, year: catalog.year, posterPath: catalog.posterPath }).from(catalog).where(inArray(catalog.id, revealedIds))
    : [];
  const byId = new Map(films.map((film) => [film.id, film]));
  return {
    partidaId: partida.id,
    day: partida.day ?? "",
    number: diariaNumber(DETALLE_ID, partida.day ?? ""),
    step: (partida.answers as unknown[]).length,
    posters: state.posters.map((poster) => {
      const film = byId.get(round.posters[poster.index]!.catalogId);
      return { ...poster, reveal: film ? { name: film.name, year: film.year, posterPath: film.posterPath } : null };
    }),
    current: state.current,
    score: state.score,
    total: DETALLE_MAX,
    finished: partida.finishedAt != null || state.finished,
  };
};

export type DetalleOpen = { status: "ok"; view: DetalleView } | { status: "unavailable"; day: string };

export const openDetalle = async (userId: string, now = new Date(), sources = defaultSources): Promise<DetalleOpen> => {
  const opened = await openDiaria({
    userId,
    juego: DETALLE_ID,
    now,
    build: async (seed, day) => {
      const exclude = collectStrings(await recentRoundContents(DETALLE_ID, day), "catalogId");
      const round = buildDetalleRound({ pool: await sources.pool(), seed, exclude });
      if (!round) throw new ShortPoolError();
      return round;
    },
  });
  return opened.status === "ok" ? { status: "ok", view: await viewOf(opened.partida) } : opened;
};

export const readDetalleView = async (userId: string, partidaId: string) => {
  const partida = await readOwnPartida(userId, DETALLE_ID, partidaId);
  return partida ? viewOf(partida) : null;
};

export type DetalleOutcome = { ok: true; correct: boolean; view: DetalleView } | { ok: false; error: string; view?: DetalleView };

/**
 * A guess (or «No sé», `guess` null) on poster `index`. Only the owner, only the current poster,
 * only once per state: `step` is how many answers the client had seen.
 */
export const answerDetalle = async (userId: string, partidaId: string, step: number, guess: TitleGuess | null, now = new Date()): Promise<DetalleOutcome> => {
  const partida = await readOwnPartida(userId, DETALLE_ID, partidaId);
  if (!partida) return { ok: false, error: "No encontramos esa partida." };
  const answers = parseDetalleAnswers(partida.answers as unknown[]);
  const round = roundOf(partida);
  const state = detalleState(answers, round.posters.length);
  if (partida.finishedAt || state.current == null || step !== (partida.answers as unknown[]).length) {
    return { ok: false, error: "Esa ya la contestaste.", view: await viewOf(partida) };
  }
  const poster = round.posters[state.current]!;
  const correct = guess != null && guess.tmdbId === poster.tmdbId;
  const answer: DetalleAnswer = { p: state.current, g: guess?.tmdbId ?? null, n: guess?.name ?? null, ok: correct };
  const next = detalleState([...answers, answer], round.posters.length);
  const result = await appendAnswer({ userId, partida, answer, score: next.score, finished: next.finished, now });
  if (!result.stored) return { ok: false, error: "Esa ya la contestaste.", view: await viewOf(result.partida) };
  return { ok: true, correct, view: await viewOf(result.partida) };
};

/** The poster path to cut for poster `index` at `level`, only when the person may see it now. */
export const readCropSource = async (userId: string, partidaId: string, index: number, level: number) => {
  const partida = await readOwnPartida(userId, DETALLE_ID, partidaId);
  if (!partida) return null;
  const round = roundOf(partida);
  const state = detalleState(parseDetalleAnswers(partida.answers as unknown[]), round.posters.length);
  if (!cropAllowed(state, index, level)) return null;
  const poster = round.posters[index]!;
  const film = await db.query.catalog.findFirst({ where: eq(catalog.id, poster.catalogId), columns: { posterPath: true } });
  return film?.posterPath ? { posterPath: film.posterPath, x: poster.x, y: poster.y, level } : null;
};
