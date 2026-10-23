import { mxToday } from "@/lib/cine-core";

/**
 * Las piezas pequeñas de Hoy (FIL-I26-3): «La oculta», one film face down per day, and «¿Las
 * viste?», three cards a day answered in ten seconds. Pure: which film, what the hint says, what
 * an answer writes and the line that closes the three. Both remember the day with `PickEvent`s.
 */

export const OCULTA_LENS = "la-oculta";
export const OCULTA_NAME = "La oculta";
export const VISTE_LENS = "las-viste";
export const VISTE_NAME = "¿Las viste?";
export const VISTE_PATH = "/las-viste";
export const VISTE_PER_DAY = 3;

export const PIEZA_EVENT_KINDS = [
  "oculta_dealt",
  "oculta_flipped",
  "viste_dealt",
  "viste_answered",
] as const;
export type PiezaEventKind = (typeof PIEZA_EVENT_KINDS)[number];

export const VISTE_ANSWERS = ["liked", "meh", "no"] as const;
export type VisteAnswer = (typeof VISTE_ANSWERS)[number];

export const isVisteAnswer = (value: unknown): value is VisteAnswer =>
  VISTE_ANSWERS.includes(value as VisteAnswer);

/**
 * «La vi, me gustó» / «La vi, no tanto» as the rating Afinidad reads (liked = ≥ 7): written only
 * when the film has no rating of the person's own. «No la vi» writes nothing.
 */
export const VISTE_RATING: Record<Exclude<VisteAnswer, "no">, number> = { liked: 8, meh: 4 };

export const VISTE_ANSWER_LABEL: Record<VisteAnswer, string> = {
  liked: "La vi, me gustó",
  meh: "La vi, no tanto",
  no: "No la vi",
};

/** `PickEvent.lens` of an answer, `viste:liked` (what metrics read). */
export const visteLens = (answer: VisteAnswer) => `viste:${answer}`;

export const answerOfLens = (lens: string | null): VisteAnswer | null => {
  const answer = lens?.startsWith("viste:") ? lens.slice("viste:".length) : null;
  return isVisteAnswer(answer) ? answer : null;
};

/** Days are Mexico City days, like Cine's: «una al día» turns at local midnight. */
export const sameMxDay = (a: Date, b: Date) => mxToday(a) === mxToday(b);

// ---------------------------------------------------------------------------
// La oculta
// ---------------------------------------------------------------------------

export type OcultaCandidate = { id: string; gusto: number; calidad: number };

/**
 * The film furthest from your taste that everyone rates well: gusto under the median, the best
 * quality among those (the wildcard Hoy already computes). Films already dealt or in the deck
 * are left out; null when nothing qualifies.
 */
export const pickOculta = <T extends OcultaCandidate>(pool: readonly T[], exclude: ReadonlySet<string>): T | null => {
  const open = pool.filter((item) => !exclude.has(item.id));
  if (open.length === 0) {
    return null;
  }
  const sorted = open.map((item) => item.gusto).sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0 ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2 : (sorted[middle] ?? 0);
  let best: T | null = null;
  for (const item of open) {
    if (item.gusto <= median && (!best || item.calidad > best.calidad)) {
      best = item;
    }
  }
  return best;
};

/** What a face-down card may say: the decade and genre, never the name. */
export const ocultaHint = (film: { year: number | null; genres: readonly string[] }) => {
  const decade = film.year ? `de los ${Math.floor(film.year / 10) * 10}` : "sin fecha";
  const genre = film.genres[0];
  return genre ? `${genre}, ${decade}` : `Una película ${decade}`;
};

/** The line under it: why this one, without giving it away. */
export const ocultaDetail = (film: { rating: number | null; seedName: string | null }) => {
  const quality = film.rating != null && film.rating >= 7 ? `Buena según todos (${film.rating.toFixed(1)})` : "Buena según todos";
  const seed = film.seedName ? ` Sale de lo que va con ${film.seedName}.` : "";
  return `${quality}, lejos de lo que sueles ver.${seed}`;
};

// ---------------------------------------------------------------------------
// ¿Las viste?
// ---------------------------------------------------------------------------

export type VisteCandidate = { tmdbId: number; voteCount: number };

/**
 * Three films you have probably seen, one per seed while there are seeds (each touches a
 * different island of your universe), the best known first. Never one you have or were asked.
 */
export const pickVisteCards = <T extends VisteCandidate>(
  perSeed: ReadonlyArray<{ seedName: string; candidates: readonly T[] }>,
  exclude: ReadonlySet<number>,
  count = VISTE_PER_DAY,
): Array<T & { seedName: string }> => {
  const picked: Array<T & { seedName: string }> = [];
  const taken = new Set(exclude);
  const queues = perSeed.map((seed) => ({
    seedName: seed.seedName,
    queue: [...seed.candidates].sort((a, b) => b.voteCount - a.voteCount),
  }));
  let progress = true;
  while (picked.length < count && progress) {
    progress = false;
    for (const seed of queues) {
      if (picked.length >= count) {
        break;
      }
      const next = seed.queue.find((item) => !taken.has(item.tmdbId));
      if (next) {
        taken.add(next.tmdbId);
        picked.push({ ...next, seedName: seed.seedName });
        progress = true;
      }
    }
  }
  return picked;
};

const listNames = (names: readonly string[]) =>
  names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} y ${names.at(-1)}`;

/**
 * What changed after the three (P2): who appeared in your universe, which ruta moved. Only gains;
 * three «No la vi» say tomorrow brings others.
 */
export const visteSummary = (input: {
  seen: number;
  newPeople: readonly string[];
  rutas: ReadonlyArray<{ shortTitle: string; done: number; total: number }>;
}) => {
  if (input.seen === 0) {
    return "Ninguna esta vez. Mañana hay otras tres.";
  }
  const parts: string[] = [];
  const people = input.newPeople.slice(0, 2);
  if (people.length > 0) {
    parts.push(`${people.length === 1 ? "Apareció" : "Aparecieron"} ${listNames(people)}`);
  }
  for (const ruta of input.rutas.slice(0, 1)) {
    parts.push(`${ruta.shortTitle} va ${ruta.done} de ${ruta.total}`);
  }
  if (parts.length === 0) {
    return input.seen === 1 ? "Una más en tu diario." : `${input.seen} más en tu diario.`;
  }
  return `${parts.join("; ")}.`;
};

/**
 * Where «La oculta» goes in Hoy: right after the rutas, else after Para ti, else first. A small
 * piece next to the big ones, never ahead of your ruta.
 */
export const placeOcultaLens = <L extends { kind: string }>(lenses: readonly L[], oculta: L): L[] => {
  const lastRuta = lenses.map((lens) => lens.kind).lastIndexOf("ruta");
  const paraTi = lenses.findIndex((lens) => lens.kind === "para-ti");
  const at = lastRuta >= 0 ? lastRuta + 1 : paraTi >= 0 ? paraTi + 1 : 0;
  return [...lenses.slice(0, at), oculta, ...lenses.slice(at)];
};
