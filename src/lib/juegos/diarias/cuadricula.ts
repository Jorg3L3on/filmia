import { seededShuffle } from "@/lib/juegos/seed";

/**
 * La cuadrícula (FIL-I54-4, board J-1-cuadricula): three people (rows) by three conditions
 * (columns); each of the nine cells takes one film where that person worked and that meets that
 * condition. Nine tries, one film per cell, never the same film in two cells. Rarity: how many of
 * the day's players gave the same answer (shown only from five players up). Pure: the conditions,
 * the generator (every cell with three or more well-known answers), judging and rarity.
 */

export const CUADRICULA_ID = "cuadricula";
export const CUADRICULA_TRIES = 9;
export const CUADRICULA_CELLS = 9;
/** Every cell of a generated grid has at least this many well-known valid films. */
export const CUADRICULA_MIN_ANSWERS = 3;
/** Below this many players of the day the rarity says «pocos datos» instead of a percentage. */
export const RARITY_MIN_PLAYERS = 5;

/** A film of a person's filmography, as the round stores it (short keys: three filmographies live in one row). */
export type GridFilm = {
  /** TMDB movie id. */
  t: number;
  /** Name to show (es-MX from Catalog when it has it). */
  n: string;
  y: number | null;
  /** TMDB genre ids. */
  g: number[];
  /** Runtime in minutes and IMDb rating: only when `Catalog` has them. */
  r: number | null;
  i: number | null;
  /** Well known (IMDb votes over the threshold, or many TMDB votes): only these count for the generator's guarantee. */
  k: boolean;
  p: string | null;
};

export type GridPerson = { id: number; name: string; role: "cast" | "director"; films: GridFilm[] };

type ConditionKind = "year" | "genre" | "runtime" | "rating";
export type GridCondition = {
  id: string;
  label: string;
  /** For the search box: «Una de Tom Hanks … de los 90». */
  short: string;
  kind: ConditionKind;
  /** null: the data is not there (runtime or rating of a film not in Catalog). */
  test: (film: GridFilm) => boolean | null;
};

const yearIn = (from: number, to: number) => (film: GridFilm) => (film.y == null ? false : film.y >= from && film.y <= to);
const genre = (id: number, label: string, short: string): GridCondition => ({
  id: `genero:${id}`,
  label,
  short,
  kind: "genre",
  test: (film) => film.g.includes(id),
});

export const GRID_CONDITIONS: readonly GridCondition[] = [
  { id: "antes:1990", label: "Estrenada antes de 1990", short: "anterior a 1990", kind: "year", test: yearIn(1800, 1989) },
  { id: "decada:1990", label: "De los 90", short: "de los 90", kind: "year", test: yearIn(1990, 1999) },
  { id: "decada:2000", label: "De los 2000", short: "de los 2000", kind: "year", test: yearIn(2000, 2009) },
  { id: "decada:2010", label: "De los 2010", short: "de los 2010", kind: "year", test: yearIn(2010, 2019) },
  { id: "antes:2010", label: "Estrenada antes de 2010", short: "anterior a 2010", kind: "year", test: yearIn(1800, 2009) },
  { id: "desde:2010", label: "Estrenada en 2010 o después", short: "de 2010 en adelante", kind: "year", test: yearIn(2010, 3000) },
  genre(35, "Comedia", "que sea comedia"),
  genre(18, "Drama", "que sea drama"),
  genre(28, "Acción", "de acción"),
  genre(878, "Ciencia ficción", "de ciencia ficción"),
  genre(53, "Suspenso", "de suspenso"),
  genre(80, "Crimen", "de crimen"),
  genre(12, "Aventura", "de aventura"),
  genre(10749, "Romance", "de romance"),
  genre(14, "Fantasía", "de fantasía"),
  genre(16, "Animación", "animada"),
  { id: "dura:140", label: "Dura más de 2 h 20", short: "de más de 2 h 20", kind: "runtime", test: (film) => (film.r == null ? null : film.r > 140) },
  { id: "dura:-100", label: "Dura menos de 1 h 40", short: "de menos de 1 h 40", kind: "runtime", test: (film) => (film.r == null ? null : film.r < 100) },
  { id: "nota:8", label: "Nota de IMDb de 8 o más", short: "con 8 o más en IMDb", kind: "rating", test: (film) => (film.i == null ? null : film.i >= 8) },
  { id: "nota:-6.5", label: "Nota de IMDb menor a 6.5", short: "con menos de 6.5 en IMDb", kind: "rating", test: (film) => (film.i == null ? null : film.i < 6.5) },
];

const CONDITION_BY_ID = new Map(GRID_CONDITIONS.map((condition) => [condition.id, condition]));
export const conditionOf = (id: string) => CONDITION_BY_ID.get(id) ?? null;

/** At most this many columns of one kind: a grid of three decades is no fun. */
const MAX_PER_KIND: Record<ConditionKind, number> = { year: 1, genre: 2, runtime: 1, rating: 1 };

/** Films of a person that meet a condition (all of them, or only the well-known ones). */
export const validFilms = (person: GridPerson, condition: GridCondition, knownOnly = false) =>
  person.films.filter((film) => (!knownOnly || film.k) && condition.test(film) === true);

/**
 * Can every cell get its own film? Each cell's well-known valid films, nine cells, no film twice:
 * a bipartite matching (augmenting paths; nine cells, so plain recursion is enough).
 */
export const hasDistinctAnswers = (cells: readonly (readonly number[])[]) => {
  const owner = new Map<number, number>();
  const assign = (cell: number, seen: Set<number>): boolean => {
    for (const film of cells[cell]!) {
      if (seen.has(film)) continue;
      seen.add(film);
      const other = owner.get(film);
      if (other == null || assign(other, seen)) {
        owner.set(film, cell);
        return true;
      }
    }
    return false;
  };
  return cells.every((_, cell) => assign(cell, new Set()));
};

export type GridRound = { rows: GridPerson[]; cols: string[] };

/**
 * The day's grid from candidate people (with their filmographies): the first three people and
 * three conditions, in seeded order, where every cell has `CUADRICULA_MIN_ANSWERS` or more
 * well-known films and the nine cells can all be filled with different films. Null when none.
 */
export const buildGrid = (input: { people: readonly GridPerson[]; seed: string; conditions?: readonly GridCondition[] }): GridRound | null => {
  const people = seededShuffle([...input.people].sort((a, b) => a.id - b.id), `${CUADRICULA_ID}|gente|${input.seed}`);
  const conditions = seededShuffle(input.conditions ?? GRID_CONDITIONS, `${CUADRICULA_ID}|condiciones|${input.seed}`);
  const enough = new Map<string, number[]>();
  const known = (person: GridPerson, condition: GridCondition) => {
    const key = `${person.id}|${condition.id}`;
    if (!enough.has(key)) enough.set(key, validFilms(person, condition, true).map((film) => film.t));
    return enough.get(key)!;
  };
  for (let a = 0; a < people.length; a += 1) {
    for (let b = a + 1; b < people.length; b += 1) {
      for (let c = b + 1; c < people.length; c += 1) {
        const rows = [people[a]!, people[b]!, people[c]!];
        const fits = conditions.filter((condition) => rows.every((person) => known(person, condition).length >= CUADRICULA_MIN_ANSWERS));
        for (let x = 0; x < fits.length; x += 1) {
          for (let y = x + 1; y < fits.length; y += 1) {
            for (let z = y + 1; z < fits.length; z += 1) {
              const cols = [fits[x]!, fits[y]!, fits[z]!];
              const perKind = new Map<ConditionKind, number>();
              for (const col of cols) perKind.set(col.kind, (perKind.get(col.kind) ?? 0) + 1);
              if ([...perKind].some(([kind, count]) => count > MAX_PER_KIND[kind])) continue;
              const cells = rows.flatMap((person) => cols.map((col) => known(person, col)));
              if (!hasDistinctAnswers(cells)) continue;
              return { rows: rows.map((person) => ({ ...person, films: [...person.films].sort((p, q) => p.t - q.t) })), cols: cols.map((col) => col.id) };
            }
          }
        }
      }
    }
  }
  return null;
};

/** Cell `cell` (0–8, row by row) → its person and condition. */
export const cellOf = (round: GridRound, cell: number) => {
  const person = round.rows[Math.floor(cell / 3)];
  const condition = conditionOf(round.cols[cell % 3] ?? "");
  return person && condition ? { person, condition } : null;
};

/** One try: film `t` (named `n`) into cell `c`. */
export type GridAnswer = { c: number; t: number; n: string; ok: boolean };

export type GridJudgement =
  /** Counts as a try: right or wrong. */
  | { kind: "right"; film: GridFilm }
  | { kind: "wrong" }
  /** Does not count: the cell is taken, the film is in another cell, or we lack the data. */
  | { kind: "taken" }
  | { kind: "repeated" }
  | { kind: "unknown" };

/** Whether film `tmdbId` fits cell `cell`, given what is already filled. */
export const judgeCell = (round: GridRound, answers: readonly GridAnswer[], cell: number, tmdbId: number): GridJudgement => {
  const target = cellOf(round, cell);
  if (!target) return { kind: "wrong" };
  const filled = answers.filter((answer) => answer.ok);
  if (filled.some((answer) => answer.c === cell)) return { kind: "taken" };
  if (filled.some((answer) => answer.t === tmdbId)) return { kind: "repeated" };
  const film = target.person.films.find((item) => item.t === tmdbId);
  if (!film) return { kind: "wrong" };
  const test = target.condition.test(film);
  return test === true ? { kind: "right", film } : test === null ? { kind: "unknown" } : { kind: "wrong" };
};

export const parseGridAnswers = (answers: readonly unknown[]): GridAnswer[] =>
  answers.flatMap((answer) => {
    if (!answer || typeof answer !== "object") return [];
    const item = answer as Partial<GridAnswer>;
    return typeof item.c === "number" && typeof item.t === "number"
      ? [{ c: item.c, t: item.t, n: typeof item.n === "string" ? item.n : "", ok: item.ok === true }]
      : [];
  });

export type GridState = {
  /** Per cell, the film that filled it. */
  filled: Map<number, GridAnswer>;
  tries: number;
  score: number;
  finished: boolean;
};

export const gridState = (answers: readonly GridAnswer[]): GridState => {
  const filled = new Map<number, GridAnswer>();
  let tries = 0;
  for (const answer of answers) {
    if (tries >= CUADRICULA_TRIES || filled.size >= CUADRICULA_CELLS) break;
    tries += 1;
    if (answer.ok && !filled.has(answer.c)) filled.set(answer.c, answer);
  }
  return { filled, tries, score: filled.size, finished: tries >= CUADRICULA_TRIES || filled.size >= CUADRICULA_CELLS };
};

// ---------------------------------------------------------------------------
// Rarity
// ---------------------------------------------------------------------------

/** Each player's filled cells: cell → TMDB id. */
export type PlayerCells = ReadonlyMap<number, number>;

/** Percentage (0–100, whole) of the day's players who put film `tmdbId` in `cell`; null below `RARITY_MIN_PLAYERS`. */
export const rarityOf = (players: readonly PlayerCells[], cell: number, tmdbId: number) => {
  if (players.length < RARITY_MIN_PLAYERS) return null;
  const same = players.filter((cells) => cells.get(cell) === tmdbId).length;
  return Math.round((same / players.length) * 100);
};

/** A player's rarity: the percentages of their nine cells added up, 100 for an empty one. Lower is better; null below five players. */
export const rarityScore = (players: readonly PlayerCells[], mine: PlayerCells) => {
  if (players.length < RARITY_MIN_PLAYERS) return null;
  let total = 0;
  for (let cell = 0; cell < CUADRICULA_CELLS; cell += 1) {
    const film = mine.get(cell);
    total += film == null ? 100 : rarityOf(players, cell, film)!;
  }
  return total;
};

export const cellsOf = (answers: readonly GridAnswer[]): Map<number, number> =>
  new Map([...gridState(answers).filled].map(([cell, answer]) => [cell, answer.t]));

/** «🟩⬜🟩 / ⬜🟩⬜ / 🟩🟩⬜»: the grid's shape, never a film. */
export const gridMarks = (filledCells: Iterable<number>) => {
  const set = new Set(filledCells);
  return [0, 1, 2].map((row) => [0, 1, 2].map((col) => (set.has(row * 3 + col) ? "🟩" : "⬜")).join("")).join("\n");
};
