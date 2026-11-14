import { DIARIA_MIN_VOTES } from "@/lib/juegos/diarias/core";
import { seededRandom, seededShuffle } from "@/lib/juegos/seed";

/**
 * Detalle (FIL-I54-1, board D-2-detalle): three posters a day, each starting as a tight crop that
 * opens in six steps, on a miss or on «No sé, ábrelo más». Fewer steps, more points. Pure: the
 * round from a seed, the crop rectangles, and the state of a partida from its answers. The crop
 * itself is cut on the server (`/extras/detalle/recorte`): the client never gets the poster path
 * before the poster is solved or failed.
 */

export const DETALLE_ID = "detalle";
export const DETALLE_POSTERS = 3;
export const DETALLE_LEVELS = 6;
/** Points for a poster solved at level n (1-based): 6 at the first crop, 1 at the last. */
export const detallePoints = (level: number) => DETALLE_LEVELS + 1 - level;
export const DETALLE_MAX = DETALLE_POSTERS * detallePoints(1);

/**
 * The side of the square crop, as a fraction of the poster's width, at each level: tight to
 * almost the whole poster. Level 6 still hides the title band most posters carry at the bottom.
 */
export const DETALLE_FRACTIONS = [0.14, 0.22, 0.32, 0.46, 0.64, 0.86] as const;

export type DetalleCandidate = { id: string; tmdbId: number; posterPath: string | null; imdbVotes: number | null };

/** One poster of the round: the film and the point the crops close in on (fractions of width and height). */
export type DetallePoster = { catalogId: string; tmdbId: number; x: number; y: number };
export type DetalleRound = { posters: DetallePoster[] };

/** Only TMDB posters (the server fetches them from TMDB's image CDN to cut the crop). */
export const isDetallePlayable = (film: DetalleCandidate) =>
  typeof film.posterPath === "string" && /^\/[^/]+\.(jpg|jpeg|png|webp)$/i.test(film.posterPath) && (film.imdbVotes ?? 0) >= DIARIA_MIN_VOTES;

/** The point a poster's crops close in on: away from the edges and from the bottom title band. */
export const detalleZone = (seed: string, index: number) => {
  const random = seededRandom(`${seed}|zona|${index}`);
  const round3 = (value: number) => Math.round(value * 1000) / 1000;
  return { x: round3(0.25 + random() * 0.5), y: round3(0.18 + random() * 0.5) };
};

/**
 * The day's three posters and their zones. The same pool and seed always give the same round;
 * `exclude` (films of recent rounds) is skipped while there are others. Null when the pool is short.
 */
export const buildDetalleRound = (input: { pool: readonly DetalleCandidate[]; seed: string; exclude?: ReadonlySet<string> }): DetalleRound | null => {
  const playable = input.pool.filter(isDetallePlayable).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const shuffled = seededShuffle(playable, `${DETALLE_ID}|${input.seed}`);
  const fresh = shuffled.filter((film) => !input.exclude?.has(film.id));
  const picked = (fresh.length >= DETALLE_POSTERS ? fresh : shuffled).slice(0, DETALLE_POSTERS);
  if (picked.length < DETALLE_POSTERS) return null;
  return { posters: picked.map((film, index) => ({ catalogId: film.id, tmdbId: film.tmdbId, ...detalleZone(input.seed, index) })) };
};

/** The square to cut at `level` (1-based) from a `width × height` poster, in whole pixels, inside the image. */
export const detalleCrop = (input: { x: number; y: number; level: number; width: number; height: number }) => {
  const fraction = DETALLE_FRACTIONS[Math.min(DETALLE_LEVELS, Math.max(1, input.level)) - 1]!;
  const size = Math.max(8, Math.min(input.width, input.height, Math.round(input.width * fraction)));
  const clamp = (value: number, max: number) => Math.min(Math.max(0, value), max);
  return {
    left: clamp(Math.round(input.x * input.width - size / 2), input.width - size),
    top: clamp(Math.round(input.y * input.height - size / 2), input.height - size),
    width: size,
    height: size,
  };
};

/** One answer: a guess (a TMDB id and the name the person picked) or «No sé» (null). */
export type DetalleAnswer = { p: number; g: number | null; n: string | null; ok: boolean };

export type DetallePosterState = {
  index: number;
  status: "pending" | "playing" | "solved" | "failed";
  /** The crop shown now (1–6); for a solved poster, the level it was solved at. */
  level: number;
  points: number;
  /** Names of the wrong guesses, in order. */
  misses: string[];
};

export type DetalleState = { posters: DetallePosterState[]; current: number | null; score: number; finished: boolean };

export const parseDetalleAnswers = (answers: readonly unknown[]): DetalleAnswer[] =>
  answers.flatMap((answer) => {
    if (!answer || typeof answer !== "object") return [];
    const item = answer as Partial<DetalleAnswer>;
    return typeof item.p === "number" ? [{ p: item.p, g: typeof item.g === "number" ? item.g : null, n: typeof item.n === "string" ? item.n : null, ok: item.ok === true }] : [];
  });

/** Where a partida stands, from its answers alone. */
export const detalleState = (answers: readonly DetalleAnswer[], posters = DETALLE_POSTERS): DetalleState => {
  const states: DetallePosterState[] = Array.from({ length: posters }, (_, index) => ({ index, status: "pending", level: 1, points: 0, misses: [] }));
  let current = 0;
  for (const answer of answers) {
    const poster = states[current];
    if (!poster || answer.p !== current) continue;
    if (answer.ok) {
      poster.status = "solved";
      poster.points = detallePoints(poster.level);
      current += 1;
    } else {
      if (answer.n) poster.misses.push(answer.n);
      if (poster.level >= DETALLE_LEVELS) {
        poster.status = "failed";
        current += 1;
      } else {
        poster.level += 1;
      }
    }
  }
  const finished = current >= posters;
  if (!finished) states[current]!.status = "playing";
  return { posters: states, current: finished ? null : current, score: states.reduce((sum, poster) => sum + poster.points, 0), finished };
};

/** Whether the person may see poster `index` cut at `level` now: only the current one, up to its level. */
export const cropAllowed = (state: DetalleState, index: number, level: number) => {
  const poster = state.posters[index];
  if (!poster || !Number.isInteger(level) || level < 1 || level > DETALLE_LEVELS) return false;
  if (poster.status === "solved" || poster.status === "failed") return true;
  return poster.status === "playing" && level <= poster.level;
};

/** «🟩🟨🟥»: one mark per poster (solved early, solved late, not solved). */
export const detalleMarks = (state: { posters: readonly Pick<DetallePosterState, "status" | "level">[] }) =>
  state.posters.map((poster) => (poster.status === "solved" ? (poster.level <= 2 ? "🟩" : poster.level <= 4 ? "🟨" : "🟧") : poster.status === "failed" ? "🟥" : "⬜")).join("");
