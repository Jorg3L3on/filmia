import { addDays } from "@/lib/cine-core";
import { seededShuffle } from "@/lib/juegos/seed";

/**
 * Mayor o menor (FIL-I52): two films, one value shown and one hidden; «Mayor» or «Menor». Pure:
 * the lenses, the seeded sequence over `Catalog`, how an answer is judged and how a result is
 * shared. Nothing here touches the database or `Title`.
 */

export const MAYOR_ID = "mayor";
export const MAYOR_PATH = "/extras/mayor-o-menor";
export const MAYOR_DAILY_PATH = `${MAYOR_PATH}/diaria`;

/** Films seen by enough people that the question makes sense (IMDb votes). */
export const MAYOR_MIN_VOTES = 25_000;
/** Pairs in the daily: ten, the same for everyone, played to the end even after a miss. */
export const MAYOR_DAILY_STEPS = 10;
/** Films a free streak draws at the start; reaching the end is «te las llevaste todas». */
export const MAYOR_FREE_LENGTH = 120;
/** Day of the daily n.º 1 (Mexico City). */
export const MAYOR_EPOCH = "2026-11-13";

export type MayorGuess = "mayor" | "menor";
export const isMayorGuess = (value: unknown): value is MayorGuess => value === "mayor" || value === "menor";

/** What a lens may read of a `Catalog` row. */
export type MayorCandidate = {
  id: string;
  name: string;
  posterPath: string | null;
  imdbRating: number | null;
  imdbVotes: number | null;
  year: number | null;
  runtimeMinutes: number | null;
  rtScore: number | null;
};

export const MAYOR_LENS_IDS = ["imdb", "year", "runtime", "critica"] as const;
export type MayorLensId = (typeof MAYOR_LENS_IDS)[number];
export const parseMayorLens = (value: unknown): MayorLensId | null =>
  MAYOR_LENS_IDS.includes(value as MayorLensId) ? (value as MayorLensId) : null;

export type MayorLens = {
  id: MayorLensId;
  /** On the lens picker. */
  label: string;
  /** Chip in the header and on the shared result. */
  short: string;
  /** The picker's line. */
  line: string;
  /**
   * «pair»: two films in a chain, the right one moves left after each answer. «single»: one film
   * per step, its audience score shown and its critics score hidden.
   */
  shape: "pair" | "single";
  /** The number compared; null leaves the film out of this lens. */
  valueOf: (film: MayorCandidate) => number | null;
  /** The shown value on the left and the revealed one on the right. */
  leftValue: (film: MayorCandidate) => number | null;
  rightValue: (film: MayorCandidate) => number | null;
  format: (value: number) => string;
  /** Small caption under each number. */
  leftCaption: string;
  rightCaption: string;
  question: (left: string, right: string) => string;
  /** Button labels: the one that means «the hidden value is lower» comes first. */
  lower: string;
  higher: string;
  /** Neighbours farther apart than this are only used when nothing closer is left. */
  maxGap: number;
};

const roundTo1 = (value: number) => Math.round(value * 10) / 10;
const audience = (film: MayorCandidate) => (film.imdbRating == null ? null : Math.round(film.imdbRating * 10));

const formatRuntime = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours === 0 ? `${rest} min` : rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
};

export const MAYOR_LENSES: Record<MayorLensId, MayorLens> = {
  imdb: {
    id: "imdb",
    label: "Nota de IMDb",
    short: "IMDb",
    line: "¿Cuál tiene mejor nota?",
    shape: "pair",
    valueOf: (film) => (film.imdbRating == null ? null : roundTo1(film.imdbRating)),
    leftValue: (film) => (film.imdbRating == null ? null : roundTo1(film.imdbRating)),
    rightValue: (film) => (film.imdbRating == null ? null : roundTo1(film.imdbRating)),
    format: (value) => value.toFixed(1),
    leftCaption: "IMDb",
    rightCaption: "IMDb",
    question: (left, right) => `¿${right} tiene mejor o peor nota que ${left}?`,
    lower: "Menor",
    higher: "Mayor",
    maxGap: 1.5,
  },
  year: {
    id: "year",
    label: "Año",
    short: "Año",
    line: "¿Cuál se estrenó antes?",
    shape: "pair",
    valueOf: (film) => film.year,
    leftValue: (film) => film.year,
    rightValue: (film) => film.year,
    format: (value) => String(value),
    leftCaption: "Estreno",
    rightCaption: "Estreno",
    question: (left, right) => `¿${right} se estrenó antes o después que ${left}?`,
    lower: "Antes",
    higher: "Después",
    maxGap: 25,
  },
  runtime: {
    id: "runtime",
    label: "Duración",
    short: "Duración",
    line: "¿Cuál es más larga?",
    shape: "pair",
    valueOf: (film) => (film.runtimeMinutes != null && film.runtimeMinutes > 0 ? film.runtimeMinutes : null),
    leftValue: (film) => film.runtimeMinutes,
    rightValue: (film) => film.runtimeMinutes,
    format: formatRuntime,
    leftCaption: "Duración",
    rightCaption: "Duración",
    question: (left, right) => `¿${right} dura más o menos que ${left}?`,
    lower: "Menos",
    higher: "Más",
    maxGap: 40,
  },
  critica: {
    id: "critica",
    label: "Crítica contra público",
    short: "Crítica",
    line: "¿Rotten Tomatoes le puso más que IMDb?",
    shape: "single",
    // The gap between critics and audience; 0 (a tie) leaves the film out.
    valueOf: (film) => {
      const people = audience(film);
      if (people == null || film.rtScore == null || film.rtScore === people) return null;
      return film.rtScore - people;
    },
    leftValue: audience,
    rightValue: (film) => film.rtScore,
    format: (value) => String(value),
    leftCaption: "Público · IMDb × 10",
    rightCaption: "Crítica · Rotten Tomatoes",
    question: (_left, right) => `¿La crítica le puso a ${right} más o menos que el público?`,
    lower: "Menos",
    higher: "Más",
    maxGap: Infinity,
  },
};

/** A film can play in a lens: well known, with a poster and with that lens's number. */
export const isPlayable = (film: MayorCandidate, lens: MayorLens) =>
  film.posterPath != null && (film.imdbVotes ?? 0) >= MAYOR_MIN_VOTES && lens.valueOf(film) != null;

/**
 * The films of a partida, in order, from a seed: the same pool, lens and seed always give the
 * same sequence. «pair» lenses chain them (step i compares film i with film i + 1), never two
 * neighbours with the same value, and prefer neighbours within `maxGap` so the answer is not
 * obvious. No film twice. Shorter than `length` only when the pool runs out.
 */
export const buildSequence = (input: {
  pool: readonly MayorCandidate[];
  lens: MayorLensId;
  seed: string;
  length: number;
}): string[] => {
  const lens = MAYOR_LENSES[input.lens];
  // Sorted first so the database's row order never changes the result.
  const playable = input.pool.filter((film) => isPlayable(film, lens)).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const remaining = seededShuffle(playable, `${input.lens}|${input.seed}`);
  if (lens.shape === "single") {
    return remaining.slice(0, input.length).map((film) => film.id);
  }
  const out: MayorCandidate[] = [];
  while (out.length < input.length && remaining.length > 0) {
    const previous = out.at(-1);
    let index = 0;
    if (previous) {
      const prev = lens.valueOf(previous)!;
      const gap = (film: MayorCandidate) => Math.abs(lens.valueOf(film)! - prev);
      index = remaining.findIndex((film) => gap(film) > 0 && gap(film) <= lens.maxGap);
      if (index < 0) index = remaining.findIndex((film) => gap(film) > 0);
      if (index < 0) break;
    }
    out.push(remaining.splice(index, 1)[0]!);
  }
  return out.map((film) => film.id);
};

/** How many answers a sequence holds. */
export const stepsOf = (sequence: readonly string[], lens: MayorLensId) =>
  MAYOR_LENSES[lens].shape === "single" ? sequence.length : Math.max(0, sequence.length - 1);

/** Films needed for `steps` answers. */
export const filmsFor = (steps: number, lens: MayorLensId) => (MAYOR_LENSES[lens].shape === "single" ? steps : steps + 1);

/** Catalog ids of step `index`: [left, right] (the same film twice in a «single» lens). */
export const stepIds = (sequence: readonly string[], lens: MayorLensId, index: number): [string, string] | null => {
  if (MAYOR_LENSES[lens].shape === "single") {
    const id = sequence[index];
    return id ? [id, id] : null;
  }
  const left = sequence[index];
  const right = sequence[index + 1];
  return left && right ? [left, right] : null;
};

/** The truth of a step: is the hidden value higher or lower than the shown one? */
export const truthOf = (lens: MayorLensId, left: MayorCandidate, right: MayorCandidate): MayorGuess | null => {
  const def = MAYOR_LENSES[lens];
  if (def.shape === "single") {
    const gap = def.valueOf(right);
    return gap == null ? null : gap > 0 ? "mayor" : "menor";
  }
  const a = def.valueOf(left);
  const b = def.valueOf(right);
  if (a == null || b == null || a === b) return null;
  return b > a ? "mayor" : "menor";
};

// ---------------------------------------------------------------------------
// The daily
// ---------------------------------------------------------------------------

const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

/** «Mayor o menor n.º 23». */
export const dailyNumber = (day: string) => Math.max(1, daysBetween(MAYOR_EPOCH, day) + 1);

/** The seed of the day's round: the same for every account. */
export const dailySeed = (day: string) => `${MAYOR_ID}|diaria|${day}`;

/** The daily's lens turns with the day (FIL-I52-5), IMDb twice as often: the game's namesake. */
export const DAILY_LENS_ROTATION: readonly MayorLensId[] = ["imdb", "year", "imdb", "runtime", "imdb", "critica"];

/** The lens of the daily on `day`: the same for every account. */
export const dailyLensOf = (day: string): MayorLensId => {
  const index = daysBetween(MAYOR_EPOCH, day);
  const size = DAILY_LENS_ROTATION.length;
  return DAILY_LENS_ROTATION[((index % size) + size) % size]!;
};

/** The day before, for the streak of days. */
export const previousDay = (day: string) => addDays(day, -1);

/**
 * Days in a row with a finished daily, ending today or yesterday (a streak is not lost until a
 * whole day passes). `days` are the `YYYY-MM-DD` of finished dailies, any order.
 */
export const dayStreak = (days: readonly string[], today: string) => {
  const set = new Set(days);
  let cursor = set.has(today) ? today : previousDay(today);
  let streak = 0;
  while (set.has(cursor)) {
    streak += 1;
    cursor = previousDay(cursor);
  }
  return streak;
};

// ---------------------------------------------------------------------------
// Sharing (FIL-I52-4)
// ---------------------------------------------------------------------------

export const squaresOf = (answers: readonly boolean[]) => answers.map((ok) => (ok ? "🟩" : "🟥")).join("");

/** The shared text: game, number, lens, score and squares. Never a film or a value. */
export const shareText = (input: { day: string; lens: MayorLensId; answers: readonly boolean[]; url: string }) => {
  const score = input.answers.filter(Boolean).length;
  return [
    `Filmia · Mayor o menor n.º ${dailyNumber(input.day)} · ${MAYOR_LENSES[input.lens].short}`,
    `${score} de ${input.answers.length}`,
    squaresOf(input.answers),
    input.url,
  ].join("\n");
};
