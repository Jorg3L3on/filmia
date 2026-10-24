import { mxToday } from "@/lib/cine-core";

/**
 * «¿Las viste?» (FIL-I26-3): cards dealt three at a time for as long as the person wants, ten
 * seconds each set. Pure: which films, what an answer writes and the line that closes each set.
 * The day is remembered with `PickEvent`s.
 */

export const VISTE_LENS = "las-viste";
export const VISTE_NAME = "¿Las viste?";
export const VISTE_PATH = "/las-viste";
/** Cards are dealt this many at a time; there is no daily limit (Jorge, 2026-10-24). */
export const VISTE_BATCH = 3;
/** Seeds a batch draws from; the start rotates with each batch. */
export const VISTE_MAX_SEEDS = 8;

/** The seeds for the n-th batch of the day: the same list, starting further along each time. */
export const rotateSeeds = <T>(seeds: readonly T[], batch: number): T[] => {
  if (seeds.length === 0) {
    return [];
  }
  const start = ((batch % seeds.length) + seeds.length) % seeds.length;
  return [...seeds.slice(start), ...seeds.slice(0, start)];
};

export const PIEZA_EVENT_KINDS = ["viste_dealt", "viste_answered"] as const;
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

/** Days are Mexico City days, like Cine's: «hoy» turns at local midnight. */
export const sameMxDay = (a: Date, b: Date) => mxToday(a) === mxToday(b);

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
  count = VISTE_BATCH,
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
    return "Ninguna de estas. Sigue con otras tres.";
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
