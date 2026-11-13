import { seededShuffle } from "@/lib/juegos/seed";

/**
 * Bingo del mes (FIL-I55-2, board G-1-bingo). Pure: the month's card (the same for every account),
 * which films fit which square, the assignment that ticks the most squares with each film used
 * once, and the lines. Squares only ask what `Catalog` can answer; none depends on other people's
 * ratings or on the person's own lists, so the card can be the same for everyone.
 *
 * Read-only: the bingo reads the diary (`Title.watchedAt` with a date) and never writes to it.
 */

export const BINGO_ID = "bingo";
export const BINGO_PATH = "/extras/bingo";
export const BINGO_SIZE = 9;

/** What a square needs to know about a film. */
export type BingoFilm = {
  catalogId: string;
  kind: "MOVIE" | "SERIES";
  year: number | null;
  runtimeMinutes: number | null;
  originalLanguage: string | null;
  genres: string[];
  awards: string | null;
  /** `YYYY-MM-DD` of its Mexican theatrical release, from `CinemaRelease`. */
  mxReleaseDate: string | null;
  /** `YYYY-MM-DD` (Mexico City) the person logged it. */
  watchedDay: string;
};

/** «En el cine»: logged within this many days after its Mexican release. */
export const IN_CINEMA_DAYS = 60;

const hasGenre = (film: BingoFilm, ...names: string[]) => film.genres.some((genre) => names.includes(genre));
const isMovie = (film: BingoFilm) => film.kind === "MOVIE";
const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

export type BingoSquareDef = {
  id: string;
  /** Short text on the square. */
  label: string;
  /** One family per kind of rule: a card takes at most two squares of a family. */
  family: "idioma" | "epoca" | "genero" | "duracion" | "premios" | "cine";
  test: (film: BingoFilm) => boolean;
};

const ASIAN = ["ja", "ko", "zh", "cn", "hi", "th", "ta", "te", "id", "vi", "tl"];

/** Every square a card can draw from. Order is irrelevant: the month's seed shuffles them. */
export const BINGO_SQUARES: readonly BingoSquareDef[] = [
  { id: "espanol", label: "Una hablada en español", family: "idioma", test: (film) => film.originalLanguage === "es" },
  { id: "asiatica", label: "Una de Asia", family: "idioma", test: (film) => ASIAN.includes(film.originalLanguage ?? "") },
  { id: "francesa", label: "Una en francés", family: "idioma", test: (film) => film.originalLanguage === "fr" },
  { id: "subtitulos", label: "Ni en inglés ni en español", family: "idioma", test: (film) => !!film.originalLanguage && !["en", "es"].includes(film.originalLanguage) },
  { id: "antes-1980", label: "Una anterior a 1980", family: "epoca", test: (film) => film.year != null && film.year < 1980 },
  { id: "ochentas", label: "Una de los 80", family: "epoca", test: (film) => film.year != null && film.year >= 1980 && film.year <= 1989 },
  { id: "noventas", label: "Una de los 90", family: "epoca", test: (film) => film.year != null && film.year >= 1990 && film.year <= 1999 },
  { id: "dosmiles", label: "Una de 2000 a 2009", family: "epoca", test: (film) => film.year != null && film.year >= 2000 && film.year <= 2009 },
  { id: "animada", label: "Una animada", family: "genero", test: (film) => hasGenre(film, "Animación") },
  { id: "terror", label: "Una de terror", family: "genero", test: (film) => hasGenre(film, "Terror") },
  { id: "comedia", label: "Una comedia", family: "genero", test: (film) => hasGenre(film, "Comedia") },
  { id: "documental", label: "Un documental", family: "genero", test: (film) => hasGenre(film, "Documental") },
  { id: "ciencia-ficcion", label: "Una de ciencia ficción", family: "genero", test: (film) => hasGenre(film, "Ciencia ficción") },
  { id: "romance", label: "Una romántica", family: "genero", test: (film) => hasGenre(film, "Romance") },
  { id: "crimen", label: "Una de crimen", family: "genero", test: (film) => hasGenre(film, "Crimen") },
  { id: "western", label: "Un western", family: "genero", test: (film) => hasGenre(film, "Western") },
  { id: "larga", label: "Más de 2 h 30", family: "duracion", test: (film) => isMovie(film) && (film.runtimeMinutes ?? 0) >= 150 },
  { id: "corta", label: "De menos de 90 min", family: "duracion", test: (film) => isMovie(film) && film.runtimeMinutes != null && film.runtimeMinutes >= 40 && film.runtimeMinutes < 90 },
  { id: "oscar", label: "Ganó un Óscar", family: "premios", test: (film) => /\bWon \d+ Oscars?\b/.test(film.awards ?? "") },
  { id: "nominada", label: "Nominada al Óscar", family: "premios", test: (film) => /\b(Won|Nominated for) \d+ Oscars?\b/.test(film.awards ?? "") },
  {
    id: "cine",
    label: "Una en el cine",
    family: "cine",
    test: (film) =>
      isMovie(film) && film.mxReleaseDate != null && film.watchedDay >= film.mxReleaseDate && daysBetween(film.mxReleaseDate, film.watchedDay) <= IN_CINEMA_DAYS,
  },
];

const MAX_PER_FAMILY = 2;

/**
 * The month's nine squares: the pool shuffled by the month (`YYYY-MM`), taking at most two of a
 * family so a card mixes kinds of rule. Same month, same card, on every server and for everyone.
 */
export const bingoCardOf = (month: string): BingoSquareDef[] => {
  const shuffled = seededShuffle(BINGO_SQUARES, `bingo:${month}`);
  const picked: BingoSquareDef[] = [];
  const perFamily = new Map<string, number>();
  for (const square of shuffled) {
    if (picked.length === BINGO_SIZE) break;
    // «Ganó un Óscar» and «Nominada al Óscar» would overlap too much on one card.
    if (square.family === "premios" && (perFamily.get("premios") ?? 0) >= 1) continue;
    if ((perFamily.get(square.family) ?? 0) >= MAX_PER_FAMILY) continue;
    picked.push(square);
    perFamily.set(square.family, (perFamily.get(square.family) ?? 0) + 1);
  }
  return picked;
};

/** The eight lines of a 3×3 card, by square index. */
export const BINGO_LINES: readonly (readonly [number, number, number])[] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

/**
 * Which film ticks which square: a maximum bipartite matching (each film one square, each square
 * one film), so the number of ticked squares is the most the films allow. Films are tried in the
 * order given (earliest logged first) and squares in card order, so the answer is stable.
 * Returns, per square index, the film's index or null.
 */
export const assignBingo = (card: readonly BingoSquareDef[], films: readonly BingoFilm[]): (number | null)[] => {
  const fits = films.map((film) => card.flatMap((square, index) => (square.test(film) ? [index] : [])));
  const squareOf = new Map<number, number>(); // square → film
  const tryFilm = (film: number, seen: Set<number>): boolean => {
    for (const square of fits[film]!) {
      if (seen.has(square)) continue;
      seen.add(square);
      const holder = squareOf.get(square);
      if (holder == null || tryFilm(holder, seen)) {
        squareOf.set(square, film);
        return true;
      }
    }
    return false;
  };
  films.forEach((_, film) => {
    tryFilm(film, new Set());
  });
  return card.map((_, index) => squareOf.get(index) ?? null);
};

/** Complete lines given which squares are ticked. */
export const completeLines = (ticked: readonly boolean[]) => BINGO_LINES.filter((line) => line.every((index) => ticked[index]));

/**
 * The fewest squares still missing for any line (0 when a line is done): «te falta una para la
 * diagonal». Returns the line and how many are missing.
 */
export const nearestLine = (ticked: readonly boolean[]) => {
  let best: { line: readonly [number, number, number]; missing: number } | null = null;
  for (const line of BINGO_LINES) {
    const missing = line.filter((index) => !ticked[index]).length;
    if (missing > 0 && (!best || missing < best.missing)) best = { line, missing };
  }
  return best;
};

/** «la diagonal», «la fila de arriba», «la columna del centro». */
export const lineName = (line: readonly [number, number, number]) => {
  const key = line.join(",");
  const names: Record<string, string> = {
    "0,1,2": "la fila de arriba",
    "3,4,5": "la fila del centro",
    "6,7,8": "la fila de abajo",
    "0,3,6": "la columna izquierda",
    "1,4,7": "la columna del centro",
    "2,5,8": "la columna derecha",
    "0,4,8": "la diagonal",
    "2,4,6": "la diagonal",
  };
  return names[key] ?? "una línea";
};

export type BingoTally = {
  /** Per square: index of the film that ticks it, or null. */
  assignment: (number | null)[];
  squares: number;
  lines: number;
  /**
   * When each complete line was completed: the latest `watchedDay` among its three films (for the
   * weekly league). Same order as the lines found.
   */
  lineDays: string[];
};

/** Everything a card says about one person's month of films. */
export const tallyBingo = (card: readonly BingoSquareDef[], films: readonly BingoFilm[]): BingoTally => {
  const assignment = assignBingo(card, films);
  const ticked = assignment.map((film) => film != null);
  const lines = completeLines(ticked);
  return {
    assignment,
    squares: ticked.filter(Boolean).length,
    lines: lines.length,
    lineDays: lines.map((line) => line.map((index) => films[assignment[index]!]!.watchedDay).sort().at(-1)!),
  };
};

/** Days left in the month (today counts): «quedan 18 días». */
export const daysLeftInMonth = (today: string) => {
  const [year, month] = today.split("-").map(Number) as [number, number];
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return last - Number(today.slice(8, 10)) + 1;
};
