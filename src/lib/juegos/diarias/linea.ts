import { DIARIA_MIN_VOTES } from "@/lib/juegos/diarias/core";
import { seededShuffle } from "@/lib/juegos/seed";

/**
 * Línea de tiempo (FIL-I54-2, board J-2-linea): one film starts on the line with its year; eight
 * more come one at a time and the person places each in the gap where its year goes. A wrong gap
 * costs one of three lives and the card still lands in its real place. Pure: the round from a
 * seed (never two films of the same year), how a placement is judged and the state of a partida.
 */

export const LINEA_ID = "linea";
/** Cards to place (the anchor is extra). */
export const LINEA_CARDS = 8;
export const LINEA_LIVES = 3;

export type LineaCandidate = { id: string; year: number | null; posterPath: string | null; imdbVotes: number | null };
export type LineaCard = { catalogId: string; year: number };
/** `cards[0]` is the anchor, already on the line; the rest come in order. */
export type LineaRound = { cards: LineaCard[] };

export const isLineaPlayable = (film: LineaCandidate) =>
  film.year != null && film.year >= 1900 && film.posterPath != null && (film.imdbVotes ?? 0) >= DIARIA_MIN_VOTES;

/**
 * The day's nine films (anchor + eight), all of different years. The same pool and seed always
 * give the same round; `exclude` (films of recent rounds) is skipped while there are others.
 */
export const buildLineaRound = (input: { pool: readonly LineaCandidate[]; seed: string; exclude?: ReadonlySet<string> }): LineaRound | null => {
  const playable = input.pool.filter(isLineaPlayable).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const shuffled = seededShuffle(playable, `${LINEA_ID}|${input.seed}`);
  const ordered = [...shuffled.filter((film) => !input.exclude?.has(film.id)), ...shuffled.filter((film) => input.exclude?.has(film.id))];
  const years = new Set<number>();
  const cards: LineaCard[] = [];
  for (const film of ordered) {
    if (cards.length > LINEA_CARDS) break;
    if (years.has(film.year!)) continue;
    years.add(film.year!);
    cards.push({ catalogId: film.id, year: film.year! });
  }
  return cards.length === LINEA_CARDS + 1 ? { cards } : null;
};

/** One placement: card `c` (1-based into `cards`) into gap `g` of the line as it stood. */
export type LineaAnswer = { c: number; g: number; ok: boolean };

export type LineaPlaced = { card: number; year: number; ok: boolean | null };

export type LineaState = {
  /** The line, oldest first; the anchor has `ok` null. */
  placed: LineaPlaced[];
  /** Index into `cards` of the card to place now; null once over. */
  current: number | null;
  lives: number;
  score: number;
  /** One per placement, in order. */
  marks: boolean[];
  finished: boolean;
};

/** Whether `year` goes in gap `gap` (0 = before the first) of a line sorted by year. */
export const fitsGap = (line: readonly { year: number }[], gap: number, year: number) =>
  Number.isInteger(gap) && gap >= 0 && gap <= line.length && (gap === 0 || line[gap - 1]!.year < year) && (gap === line.length || year < line[gap]!.year);

const insertSorted = (line: LineaPlaced[], item: LineaPlaced) => {
  const at = line.findIndex((other) => other.year > item.year);
  if (at < 0) line.push(item);
  else line.splice(at, 0, item);
};

export const parseLineaAnswers = (answers: readonly unknown[]): LineaAnswer[] =>
  answers.flatMap((answer) => {
    if (!answer || typeof answer !== "object") return [];
    const item = answer as Partial<LineaAnswer>;
    return typeof item.c === "number" && typeof item.g === "number" ? [{ c: item.c, g: item.g, ok: item.ok === true }] : [];
  });

/** Where a partida stands, from the round and its answers. */
export const lineaState = (round: LineaRound, answers: readonly LineaAnswer[]): LineaState => {
  const placed: LineaPlaced[] = [{ card: 0, year: round.cards[0]!.year, ok: null }];
  let lives = LINEA_LIVES;
  const marks: boolean[] = [];
  let next = 1;
  for (const answer of answers) {
    if (lives === 0 || next >= round.cards.length || answer.c !== next) continue;
    const card = round.cards[next]!;
    insertSorted(placed, { card: next, year: card.year, ok: answer.ok });
    marks.push(answer.ok);
    if (!answer.ok) lives -= 1;
    next += 1;
  }
  const finished = lives === 0 || next >= round.cards.length;
  return { placed, current: finished ? null : next, lives, score: marks.filter(Boolean).length, marks, finished };
};

/** «Antes de 1985», «Entre 1985 y 1994», «Después de 2017». */
export const gapLabel = (line: readonly { year: number }[], gap: number) =>
  gap === 0 ? `Antes de ${line[0]!.year}` : gap === line.length ? `Después de ${line[gap - 1]!.year}` : `Entre ${line[gap - 1]!.year} y ${line[gap]!.year}`;

/** «🟩🟩🟥🟩…» and a ❤️ count left. */
export const lineaMarks = (state: Pick<LineaState, "marks">) => state.marks.map((ok) => (ok ? "🟩" : "🟥")).join("");
