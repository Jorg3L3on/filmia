import { seededShuffle } from "@/lib/juegos/seed";

/**
 * Duelo de trivia (FIL-I53-5): five questions made from `Catalog`, the same five for both people,
 * 15 seconds each, points for speed. Pure: the generator and the scoring. The right answer lives
 * only in the stored question; what reaches the client is `publicQuestion`.
 */

export const TRIVIA_ID = "trivia";
export const TRIVIA_QUESTIONS = 5;
export const TRIVIA_SECONDS = 15;
export const TRIVIA_MS = TRIVIA_SECONDS * 1000;
/** Well-known films only, so the questions are fair. */
export const TRIVIA_MIN_VOTES = 25_000;

export type TriviaPerson = { name: string; role: string; order?: number };

export type TriviaCandidate = {
  id: string;
  name: string;
  posterPath: string | null;
  year: number | null;
  runtimeMinutes: number | null;
  imdbRating: number | null;
  genres: string[];
  people: TriviaPerson[];
};

export const TRIVIA_KINDS = ["director", "year", "cast", "runtime", "rating"] as const;
export type TriviaKind = (typeof TRIVIA_KINDS)[number];

export const TRIVIA_CHIPS: Record<TriviaKind, string> = {
  director: "Dirección",
  year: "Año",
  cast: "Reparto",
  runtime: "Duración",
  rating: "Nota",
};

export type TriviaOption = { label: string; catalogId: string | null; posterPath: string | null };

/** A stored question: the server's copy, with the right answer. */
export type TriviaQuestion = {
  kind: TriviaKind;
  /** The film asked about (null when the question compares four films). */
  catalogId: string | null;
  posterPath: string | null;
  prompt: string;
  /** Short label for the result table: «Quién dirigió Gladiador». */
  label: string;
  options: TriviaOption[];
  correct: number;
};

/** What the client gets: never which option is right. */
export type PublicTriviaQuestion = Omit<TriviaQuestion, "correct">;

export const publicQuestion = (question: TriviaQuestion): PublicTriviaQuestion => ({
  kind: question.kind,
  catalogId: question.catalogId,
  posterPath: question.posterPath,
  prompt: question.prompt,
  label: question.label,
  options: question.options,
});

/** Points for one answer: 0 if wrong or after 15 s on the server's clock; 50–100 by speed. */
export const triviaPoints = (correct: boolean, elapsedMs: number) => {
  if (!correct || elapsedMs > TRIVIA_MS || elapsedMs < 0) return 0;
  return 50 + Math.round(50 * (1 - elapsedMs / TRIVIA_MS));
};

const LATIN_NAME = /^[\p{Script=Latin}\p{M}\s.'’-]+$/u;
const decadeOf = (film: TriviaCandidate) => (film.year == null ? null : Math.floor(film.year / 10));
const roundRating = (value: number) => Math.round(value * 10) / 10;

const directorsOf = (film: TriviaCandidate) => film.people.filter((person) => person.role === "director").map((person) => person.name);
const castOf = (film: TriviaCandidate) =>
  film.people
    .filter((person) => person.role === "cast" && LATIN_NAME.test(person.name))
    .sort((a, b) => (a.order ?? 99) - (b.order ?? 99))
    .map((person) => person.name);
const everyoneIn = (film: TriviaCandidate) => new Set(film.people.map((person) => person.name));

/** Others sorted so the believable ones (same decade or a shared genre) come first; seeded. */
const believable = (subject: TriviaCandidate, others: readonly TriviaCandidate[], seed: string) => {
  const decade = decadeOf(subject);
  const genres = new Set(subject.genres);
  const score = (film: TriviaCandidate) => (decadeOf(film) === decade ? 2 : 0) + (film.genres.some((genre) => genres.has(genre)) ? 1 : 0);
  return seededShuffle(others, seed).sort((a, b) => score(b) - score(a));
};

const option = (label: string, film?: TriviaCandidate | null): TriviaOption => ({
  label,
  catalogId: film?.id ?? null,
  posterPath: film?.posterPath ?? null,
});

/** Puts the right option among the others in a seeded order. */
const withOptions = (base: Omit<TriviaQuestion, "options" | "correct">, right: TriviaOption, wrong: TriviaOption[], seed: string): TriviaQuestion => {
  const options = seededShuffle([right, ...wrong], `${seed}|opciones`);
  return { ...base, options, correct: options.indexOf(right) };
};

type Maker = (subject: TriviaCandidate, pool: readonly TriviaCandidate[], seed: string) => TriviaQuestion | null;

const MAKERS: Record<TriviaKind, Maker> = {
  director: (subject, pool, seed) => {
    const mine = directorsOf(subject);
    if (mine.length === 0) return null;
    const taken = new Set(mine);
    const wrong: string[] = [];
    for (const film of believable(subject, pool, seed)) {
      for (const name of directorsOf(film)) {
        if (!taken.has(name) && LATIN_NAME.test(name)) {
          taken.add(name);
          wrong.push(name);
        }
      }
      if (wrong.length >= 3) break;
    }
    if (wrong.length < 3) return null;
    return withOptions(
      { kind: "director", catalogId: subject.id, posterPath: subject.posterPath, prompt: `¿Quién dirigió ${subject.name}?`, label: `Quién dirigió ${subject.name}` },
      option(mine[0]!),
      wrong.slice(0, 3).map((name) => option(name)),
      seed,
    );
  },
  year: (subject, _pool, seed) => {
    if (subject.year == null) return null;
    const near = seededShuffle([-6, -5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 6], `${seed}|años`)
      .map((offset) => subject.year! + offset)
      .filter((year) => year > 1900)
      .slice(0, 3);
    if (near.length < 3) return null;
    return withOptions(
      { kind: "year", catalogId: subject.id, posterPath: subject.posterPath, prompt: `¿En qué año se estrenó ${subject.name}?`, label: `El año de ${subject.name}` },
      option(String(subject.year)),
      near.map((year) => option(String(year))),
      seed,
    );
  },
  cast: (subject, pool, seed) => {
    const cast = castOf(subject).slice(0, 6);
    if (cast.length < 3) return null;
    const inFilm = everyoneIn(subject);
    let intruder: string | null = null;
    for (const film of believable(subject, pool, seed)) {
      intruder = castOf(film).slice(0, 4).find((name) => !inFilm.has(name)) ?? null;
      if (intruder) break;
    }
    if (!intruder) return null;
    return withOptions(
      {
        kind: "cast",
        catalogId: subject.id,
        posterPath: subject.posterPath,
        prompt: `¿Quién de estas personas no sale en ${subject.name}?`,
        label: `Quién no sale en ${subject.name}`,
      },
      option(intruder),
      seededShuffle(cast, `${seed}|reparto`).slice(0, 3).map((name) => option(name)),
      seed,
    );
  },
  runtime: (subject, pool, seed) => {
    if (subject.runtimeMinutes == null || subject.runtimeMinutes <= 0) return null;
    const runtimes = new Set([subject.runtimeMinutes]);
    const picked = [subject];
    for (const film of believable(subject, pool, seed)) {
      const minutes = film.runtimeMinutes;
      if (minutes == null || minutes <= 0 || runtimes.has(minutes) || Math.abs(minutes - subject.runtimeMinutes) > 45) continue;
      runtimes.add(minutes);
      picked.push(film);
      if (picked.length === 4) break;
    }
    if (picked.length < 4) return null;
    const longest = picked.reduce((best, film) => (film.runtimeMinutes! > best.runtimeMinutes! ? film : best));
    return withOptions(
      { kind: "runtime", catalogId: null, posterPath: null, prompt: "¿Cuál dura más?", label: "La que dura más" },
      option(longest.name, longest),
      picked.filter((film) => film !== longest).map((film) => option(film.name, film)),
      seed,
    );
  },
  rating: (subject, pool, seed) => {
    if (subject.imdbRating == null) return null;
    const ratings = new Set([roundRating(subject.imdbRating)]);
    const picked = [subject];
    for (const film of believable(subject, pool, seed)) {
      if (film.imdbRating == null) continue;
      const rating = roundRating(film.imdbRating);
      if (ratings.has(rating) || Math.abs(rating - roundRating(subject.imdbRating)) > 1.5) continue;
      ratings.add(rating);
      picked.push(film);
      if (picked.length === 4) break;
    }
    if (picked.length < 4) return null;
    const best = picked.reduce((top, film) => (roundRating(film.imdbRating!) > roundRating(top.imdbRating!) ? film : top));
    return withOptions(
      { kind: "rating", catalogId: null, posterPath: null, prompt: "¿Cuál tiene mejor nota en IMDb?", label: "La mejor nota en IMDb" },
      option(best.name, best),
      picked.filter((film) => film !== best).map((film) => option(film.name, film)),
      seed,
    );
  },
};

/**
 * Five questions from a seed: one of each kind when the data allows it (in a seeded order), never
 * the same film asked twice and never a film whose name is repeated in the pool (it would be
 * ambiguous). Fewer than five only when the pool is too thin.
 */
export const generateTrivia = (pool: readonly TriviaCandidate[], seed: string, count = TRIVIA_QUESTIONS): TriviaQuestion[] => {
  const nameCounts = new Map<string, number>();
  for (const film of pool) nameCounts.set(film.name, (nameCounts.get(film.name) ?? 0) + 1);
  const usable = [...pool].filter((film) => nameCounts.get(film.name) === 1).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const subjects = seededShuffle(usable, `${seed}|películas`);
  const kinds = seededShuffle(TRIVIA_KINDS, `${seed}|tipos`);
  const order = [...kinds, ...seededShuffle(TRIVIA_KINDS, `${seed}|tipos-2`)];
  const used = new Set<string>();
  const out: TriviaQuestion[] = [];
  for (const [step, kind] of order.entries()) {
    if (out.length >= count) break;
    for (const subject of subjects) {
      if (used.has(subject.id)) continue;
      const question = MAKERS[kind](subject, usable.filter((film) => film.id !== subject.id), `${seed}|${step}`);
      if (!question) continue;
      used.add(subject.id);
      for (const choice of question.options) if (choice.catalogId) used.add(choice.catalogId);
      out.push(question);
      break;
    }
  }
  return out;
};

/**
 * Whether a stored question has exactly one right option by the data it was made from: the check
 * the tests run over hundreds of generated questions.
 */
export const isUnambiguous = (question: TriviaQuestion, byId: ReadonlyMap<string, TriviaCandidate>) => {
  const labels = question.options.map((choice) => choice.label);
  if (new Set(labels).size !== labels.length || question.options.length !== 4) return false;
  const subject = question.catalogId ? byId.get(question.catalogId) : null;
  const truth = question.options.map((choice) => {
    switch (question.kind) {
      case "director":
        return directorsOf(subject!).includes(choice.label);
      case "year":
        return String(subject!.year) === choice.label;
      case "cast":
        return !everyoneIn(subject!).has(choice.label);
      case "runtime": {
        const films = question.options.map((item) => byId.get(item.catalogId!)!);
        const max = Math.max(...films.map((film) => film.runtimeMinutes!));
        return byId.get(choice.catalogId!)!.runtimeMinutes === max;
      }
      case "rating": {
        const films = question.options.map((item) => byId.get(item.catalogId!)!);
        const max = Math.max(...films.map((film) => roundRating(film.imdbRating!)));
        return roundRating(byId.get(choice.catalogId!)!.imdbRating!) === max;
      }
    }
  });
  return truth.filter(Boolean).length === 1 && truth[question.correct] === true;
};
