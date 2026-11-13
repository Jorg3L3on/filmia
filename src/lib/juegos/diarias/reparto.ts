import { DIARIA_MIN_VOTES } from "@/lib/juegos/diarias/core";
import { seededShuffle } from "@/lib/juegos/seed";
import { parseStoredTmdbPeople } from "@/lib/tmdb-people";

/**
 * Reparto misterioso (FIL-I54-3, board J-3-reparto): one film a day, guessed from its cast. The
 * six top-billed people appear from the least known (6th billed) to the lead; each miss or «Otra
 * pista» uncovers the next one; six tries. Pure: who can play, the round from a seed and the state
 * of a partida.
 */

export const REPARTO_ID = "reparto";
export const REPARTO_CAST = 6;
export const REPARTO_TRIES = 6;
/** Points for a film guessed on try n (1-based): 6 on the first, 1 on the sixth. */
export const repartoPoints = (tryNumber: number) => REPARTO_TRIES + 1 - tryNumber;

export type RepartoCandidate = { id: string; tmdbId: number; imdbVotes: number | null; tmdbPeople: unknown };
export type RepartoPerson = { id: number; name: string; character: string | null };
/** `cast` in reveal order: the 6th billed first, the lead last. */
export type RepartoRound = { catalogId: string; tmdbId: number; cast: RepartoPerson[] };

/** The six top-billed cast members of a film, lead first; fewer than six when the film has fewer. */
export const topCast = (tmdbPeople: unknown): RepartoPerson[] => {
  const seen = new Set<number>();
  return parseStoredTmdbPeople(tmdbPeople)
    .map((person, index) => ({ person, index }))
    .filter(({ person }) => person.role === "cast")
    .sort((a, b) => (a.person.order ?? a.index + 1000) - (b.person.order ?? b.index + 1000))
    .flatMap(({ person }) => {
      if (seen.has(person.id)) return [];
      seen.add(person.id);
      return [{ id: person.id, name: person.name, character: person.character ?? null }];
    })
    .slice(0, REPARTO_CAST);
};

export const isRepartoPlayable = (film: RepartoCandidate) => (film.imdbVotes ?? 0) >= DIARIA_MIN_VOTES && topCast(film.tmdbPeople).length >= REPARTO_CAST;

/** The day's film. The same pool and seed give the same round; recent films are skipped while there are others. */
export const buildRepartoRound = (input: { pool: readonly RepartoCandidate[]; seed: string; exclude?: ReadonlySet<string> }): RepartoRound | null => {
  const playable = input.pool.filter(isRepartoPlayable).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const shuffled = seededShuffle(playable, `${REPARTO_ID}|${input.seed}`);
  const film = shuffled.find((item) => !input.exclude?.has(item.id)) ?? shuffled[0];
  if (!film) return null;
  return { catalogId: film.id, tmdbId: film.tmdbId, cast: topCast(film.tmdbPeople).reverse() };
};

/** One try: a guess (TMDB id and the name picked) or «Otra pista» (null). */
export type RepartoAnswer = { g: number | null; n: string | null; ok: boolean };

export type RepartoState = {
  /** People uncovered now (1–6). */
  shown: number;
  tries: number;
  misses: string[];
  solved: boolean;
  score: number;
  finished: boolean;
  /** One per try: false a miss, true the hit. */
  marks: boolean[];
};

export const parseRepartoAnswers = (answers: readonly unknown[]): RepartoAnswer[] =>
  answers.flatMap((answer) => {
    if (!answer || typeof answer !== "object") return [];
    const item = answer as Partial<RepartoAnswer>;
    return [{ g: typeof item.g === "number" ? item.g : null, n: typeof item.n === "string" ? item.n : null, ok: item.ok === true }];
  });

export const repartoState = (answers: readonly RepartoAnswer[]): RepartoState => {
  const marks: boolean[] = [];
  const misses: string[] = [];
  let solved = false;
  for (const answer of answers) {
    if (solved || marks.length >= REPARTO_TRIES) break;
    marks.push(answer.ok);
    if (answer.ok) solved = true;
    else if (answer.n) misses.push(answer.n);
  }
  const tries = marks.length;
  return {
    shown: Math.min(REPARTO_CAST, solved ? tries : tries + 1),
    tries,
    misses,
    solved,
    score: solved ? repartoPoints(tries) : 0,
    finished: solved || tries >= REPARTO_TRIES,
    marks,
  };
};

/** «🟥🟥🟩⬜⬜⬜». */
export const repartoMarks = (state: Pick<RepartoState, "marks">) =>
  Array.from({ length: REPARTO_TRIES }, (_, index) => (state.marks[index] === true ? "🟩" : state.marks[index] === false ? "🟥" : "⬜")).join("");
