import { and, eq, gte, inArray } from "drizzle-orm";
import { catalog, db, juegoPartidas } from "@/db";
import { DIARIA_LENS, DIARIA_MIN_VOTES, diariaNumber, type TitleGuess } from "@/lib/juegos/diarias/core";
import {
  buildGrid,
  cellOf,
  cellsOf,
  conditionOf,
  CUADRICULA_CELLS,
  CUADRICULA_ID,
  CUADRICULA_TRIES,
  gridState,
  judgeCell,
  parseGridAnswers,
  rarityOf,
  rarityScore,
  type GridAnswer,
  type GridFilm,
  type GridPerson,
  type GridRound,
  type PlayerCells,
} from "@/lib/juegos/diarias/cuadricula";
import { appendAnswer, openDiaria, readOwnPartida, ShortPoolError } from "@/lib/juegos/diarias/store";
import type { PartidaRow } from "@/lib/juegos/partidas";
import { seededShuffle } from "@/lib/juegos/seed";
import type { TmdbCombinedCredits } from "@/lib/person-filmography";
import { getTmdbPersonCredits, isTmdbConfigured } from "@/lib/tmdb";
import { parseStoredTmdbPeople } from "@/lib/tmdb-people";

/**
 * La cuadrícula on the database (FIL-I54-4). Making the day's round is the only step that calls
 * TMDB: one `combined_credits` per candidate person (the same 24 h cache the filmography uses),
 * at most `MAX_PEOPLE_FETCHED` a day. The three filmographies are stored in the round, so judging
 * an answer never calls TMDB again. The client gets the people's names and the conditions, never
 * the filmographies.
 */

/** TMDB filmographies read to make one grid, at most. */
export const MAX_PEOPLE_FETCHED = 12;
/** A film not in Catalog counts as well known from this many TMDB votes. */
const TMDB_KNOWN_VOTES = 1500;
/** Candidate people: who appears in at least this many well-known Catalog films. */
const MIN_CATALOG_FILMS = 2;
/** Cast this high in the billing count as a lead for picking candidates. */
const LEAD_ORDER = 3;

const SELF = /^(self|himself|herself|themselves|themself)\b/i;

export type GridCandidate = { id: number; name: string; role: "cast" | "director" };
export type CuadriculaSources = {
  candidates: () => Promise<GridCandidate[]>;
  /** TMDB credits of a person (`combined_credits`) and their name on `/person` (Latin script, unlike some stored credits). */
  credits: (personId: number) => Promise<{ name: string | null; credits: TmdbCombinedCredits }>;
};

/** Directors and leads of well-known Catalog films, most frequent first (ties by id). */
export const loadGridCandidates = async (): Promise<GridCandidate[]> => {
  const rows = await db
    .select({ tmdbPeople: catalog.tmdbPeople })
    .from(catalog)
    .where(and(eq(catalog.kind, "MOVIE"), gte(catalog.imdbVotes, DIARIA_MIN_VOTES)));
  const counts = new Map<string, { candidate: GridCandidate; count: number }>();
  for (const row of rows) {
    for (const person of parseStoredTmdbPeople(row.tmdbPeople)) {
      const role = person.role === "director" ? "director" : person.role === "cast" && (person.order ?? 99) <= LEAD_ORDER ? "cast" : null;
      if (!role) continue;
      const key = `${role}|${person.id}`;
      const entry = counts.get(key) ?? { candidate: { id: person.id, name: person.name, role }, count: 0 };
      entry.count += 1;
      counts.set(key, entry);
    }
  }
  return [...counts.values()]
    .filter((entry) => entry.count >= MIN_CATALOG_FILMS)
    .sort((a, b) => b.count - a.count || a.candidate.id - b.candidate.id)
    .map((entry) => entry.candidate);
};

const defaultSources: CuadriculaSources = {
  candidates: loadGridCandidates,
  credits: async (personId) => {
    const { person, credits } = await getTmdbPersonCredits(personId);
    return { name: person.name || null, credits };
  },
};

const yearOf = (date: string | undefined) => (date && /^\d{4}/.test(date) ? Number(date.slice(0, 4)) : null);

/** A person's movies from their TMDB credits, enriched with what Catalog knows (name, runtime, IMDb). */
export const filmographyOf = async (candidate: GridCandidate, credits: TmdbCombinedCredits): Promise<GridFilm[]> => {
  type Credit = NonNullable<TmdbCombinedCredits["cast"]>[number];
  const entries: Credit[] =
    candidate.role === "director"
      ? (credits.crew ?? []).filter((credit) => credit.job === "Director")
      : (credits.cast ?? []).filter((credit) => !SELF.test(credit.character?.trim() ?? ""));
  const byId = new Map<number, Credit & { vote_count?: number }>();
  for (const credit of entries) {
    if (credit.media_type !== "movie" || !credit.id || credit.adult || credit.video) continue;
    if (!yearOf(credit.release_date)) continue;
    byId.set(credit.id, credit);
  }
  const ids = [...byId.keys()];
  const stored = ids.length
    ? await db
        .select({ tmdbId: catalog.tmdbId, name: catalog.name, runtime: catalog.runtimeMinutes, imdb: catalog.imdbRating, votes: catalog.imdbVotes, posterPath: catalog.posterPath })
        .from(catalog)
        .where(and(eq(catalog.kind, "MOVIE"), inArray(catalog.tmdbId, ids)))
    : [];
  const known = new Map(stored.map((row) => [row.tmdbId, row]));
  return ids.map((id) => {
    const credit = byId.get(id)!;
    const row = known.get(id);
    return {
      t: id,
      n: row?.name ?? credit.title?.trim() ?? credit.original_title?.trim() ?? "Película",
      y: yearOf(credit.release_date),
      g: (credit.genre_ids ?? []).filter((genre) => Number.isInteger(genre)),
      r: row?.runtime && row.runtime > 0 ? row.runtime : null,
      i: row?.imdb ?? null,
      k: (row?.votes ?? 0) >= DIARIA_MIN_VOTES || (credit.vote_count ?? 0) >= TMDB_KNOWN_VOTES,
      p: row?.posterPath ?? credit.poster_path ?? null,
    };
  });
};

/**
 * The day's grid: candidates in seeded order, one TMDB filmography each, until three people and
 * three conditions make a grid (or `MAX_PEOPLE_FETCHED` people were read). A person whose credits
 * fail is skipped. `fetched` says how many filmographies were read, for the usage note.
 */
export const makeGrid = async (seed: string, sources: CuadriculaSources = defaultSources) => {
  const candidates = seededShuffle((await sources.candidates()).slice(0, 60), `${CUADRICULA_ID}|candidatos|${seed}`);
  const people: GridPerson[] = [];
  let fetched = 0;
  for (const candidate of candidates) {
    if (fetched >= MAX_PEOPLE_FETCHED) break;
    fetched += 1;
    const fetchedPerson = await sources.credits(candidate.id).catch(() => null);
    if (!fetchedPerson) continue;
    const films = await filmographyOf(candidate, fetchedPerson.credits);
    if (films.filter((film) => film.k).length < 3) continue;
    people.push({ id: candidate.id, name: fetchedPerson.name ?? candidate.name, role: candidate.role, films });
    if (people.length >= 3) {
      const round = buildGrid({ people, seed });
      if (round) return { round, fetched };
    }
  }
  return { round: null, fetched };
};

const defaultReady = () => isTmdbConfigured();

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------

export type GridCellView = {
  index: number;
  /** The film that filled it. */
  film: { tmdbId: number; name: string; posterPath: string | null; rarity: number | null } | null;
};

export type CuadriculaView = {
  partidaId: string;
  day: string;
  number: number;
  step: number;
  rows: Array<{ name: string; role: "cast" | "director" }>;
  cols: Array<{ label: string; short: string }>;
  cells: GridCellView[];
  /** Wrong tries, newest last («Titanic en DiCaprio · De los 2000»). */
  misses: string[];
  tries: number;
  maxTries: number;
  score: number;
  total: number;
  finished: boolean;
  /** Players of the day (with one answer or more) and the person's rarity; null below five. */
  players: number;
  rarity: number | null;
};

const roundOf = (partida: PartidaRow) => partida.content as GridRound;

/** Every day player's filled cells (partidas with at least one answer). */
const loadPlayers = async (day: string): Promise<Array<{ userId: string; cells: PlayerCells }>> => {
  const rows = await db
    .select({ userId: juegoPartidas.userId, answers: juegoPartidas.answers })
    .from(juegoPartidas)
    .where(and(eq(juegoPartidas.juego, CUADRICULA_ID), eq(juegoPartidas.lens, DIARIA_LENS), eq(juegoPartidas.day, day), eq(juegoPartidas.mode, "diaria")));
  return rows
    .filter((row) => (row.answers as unknown[]).length > 0)
    .map((row) => ({ userId: row.userId, cells: cellsOf(parseGridAnswers(row.answers as unknown[])) }));
};

const viewOf = async (partida: PartidaRow): Promise<CuadriculaView> => {
  const round = roundOf(partida);
  const answers = parseGridAnswers(partida.answers as unknown[]);
  const state = gridState(answers);
  const players = await loadPlayers(partida.day ?? "");
  const everyone = players.map((player) => player.cells);
  const finished = partida.finishedAt != null || state.finished;
  return {
    partidaId: partida.id,
    day: partida.day ?? "",
    number: diariaNumber(CUADRICULA_ID, partida.day ?? ""),
    step: (partida.answers as unknown[]).length,
    rows: round.rows.map((person) => ({ name: person.name, role: person.role })),
    cols: round.cols.map((id) => ({ label: conditionOf(id)?.label ?? id, short: conditionOf(id)?.short ?? "" })),
    cells: Array.from({ length: CUADRICULA_CELLS }, (_, index) => {
      const answer = state.filled.get(index);
      if (!answer) return { index, film: null };
      const film = cellOf(round, index)?.person.films.find((item) => item.t === answer.t);
      return { index, film: { tmdbId: answer.t, name: film?.n ?? answer.n, posterPath: film?.p ?? null, rarity: rarityOf(everyone, index, answer.t) } };
    }),
    misses: answers.filter((answer) => !answer.ok).map((answer) => answer.n),
    tries: state.tries,
    maxTries: CUADRICULA_TRIES,
    score: state.score,
    total: CUADRICULA_CELLS,
    finished,
    players: players.length,
    rarity: rarityScore(everyone, cellsOf(answers)),
  };
};

export type CuadriculaOpen = { status: "ok"; view: CuadriculaView } | { status: "unavailable"; day: string };

export const openCuadricula = async (userId: string, now = new Date(), sources: CuadriculaSources = defaultSources, ready = defaultReady): Promise<CuadriculaOpen> => {
  const opened = await openDiaria({
    userId,
    juego: CUADRICULA_ID,
    now,
    build: async (seed) => {
      if (!ready()) throw new ShortPoolError();
      const { round } = await makeGrid(seed, sources);
      if (!round) throw new ShortPoolError();
      return round;
    },
  });
  return opened.status === "ok" ? { status: "ok", view: await viewOf(opened.partida) } : opened;
};

export type CuadriculaOutcome =
  | { ok: true; correct: boolean; view: CuadriculaView }
  /** `counted: false`: the try was not spent (cell taken, film repeated, data missing). */
  | { ok: false; error: string; view?: CuadriculaView };

/** A film into cell `cell`. Right or wrong spends a try; a repeated film or a taken cell does not. */
export const answerCuadricula = async (userId: string, partidaId: string, step: number, cell: number, guess: TitleGuess, now = new Date()): Promise<CuadriculaOutcome> => {
  const partida = await readOwnPartida(userId, CUADRICULA_ID, partidaId);
  if (!partida) return { ok: false, error: "No encontramos esa partida." };
  const answers = parseGridAnswers(partida.answers as unknown[]);
  const state = gridState(answers);
  if (partida.finishedAt || state.finished || step !== (partida.answers as unknown[]).length) {
    return { ok: false, error: "Esa ya la contestaste.", view: await viewOf(partida) };
  }
  if (!Number.isInteger(cell) || cell < 0 || cell >= CUADRICULA_CELLS) return { ok: false, error: "Esa casilla no existe." };
  const judged = judgeCell(roundOf(partida), answers, cell, guess.tmdbId);
  if (judged.kind === "taken") return { ok: false, error: "Esa casilla ya está llena.", view: await viewOf(partida) };
  if (judged.kind === "repeated") return { ok: false, error: "Ya usaste esa película en otra casilla. Prueba con otra.", view: await viewOf(partida) };
  if (judged.kind === "unknown") return { ok: false, error: "No tenemos ese dato de esa película. Prueba con otra; no se te cuenta.", view: await viewOf(partida) };
  const correct = judged.kind === "right";
  const answer: GridAnswer = { c: cell, t: guess.tmdbId, n: guess.name, ok: correct };
  const next = gridState([...answers, answer]);
  const result = await appendAnswer({ userId, partida, answer, score: next.score, finished: next.finished, now });
  if (!result.stored) return { ok: false, error: "Esa ya la contestaste.", view: await viewOf(result.partida) };
  return { ok: true, correct, view: await viewOf(result.partida) };
};

/** Each finished row's rarity on the day table (null below five players). */
export const loadRarities = async (day: string) => {
  const players = await loadPlayers(day);
  const everyone = players.map((player) => player.cells);
  return new Map(players.map((player) => [player.userId, rarityScore(everyone, player.cells)]));
};
