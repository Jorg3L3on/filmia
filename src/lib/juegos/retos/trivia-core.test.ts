import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { seededRandom } from "@/lib/juegos/seed";
import {
  generateTrivia,
  isUnambiguous,
  publicQuestion,
  TRIVIA_KINDS,
  TRIVIA_MS,
  triviaPoints,
  type TriviaCandidate,
} from "@/lib/juegos/retos/trivia-core";

/** A fictitious pool: 60 films, directors shared now and then, casts that overlap, close numbers. */
const pool = (): TriviaCandidate[] => {
  const random = seededRandom("pool-trivia");
  const directors = ["Ana Torres", "Luis Gómez", "Marta Ríos", "Pedro Sala", "Inés Mora", "Raúl Vega", "Sofía Paz", "Diego Luna"];
  const actors = Array.from({ length: 40 }, (_, index) => `Actriz ${String.fromCharCode(65 + (index % 26))}${String.fromCharCode(97 + Math.floor(index / 26))}ña`);
  const genres = ["Drama", "Comedia", "Acción", "Terror"];
  return Array.from({ length: 60 }, (_, index) => {
    const cast = Array.from({ length: 6 }, () => actors[Math.floor(random() * actors.length)]!).filter((name, position, all) => all.indexOf(name) === position);
    return {
      id: `c${String(index).padStart(3, "0")}`,
      name: `Película ${index + 1}`,
      posterPath: `/p${index}.jpg`,
      year: 1970 + Math.floor(random() * 50),
      runtimeMinutes: 80 + Math.floor(random() * 80),
      imdbRating: Math.round((5 + random() * 4) * 10) / 10,
      genres: [genres[index % genres.length]!],
      people: [
        { name: directors[index % directors.length]!, role: "director" },
        ...(index % 9 === 0 ? [{ name: directors[(index + 3) % directors.length]!, role: "director" }] : []),
        ...cast.map((name, order) => ({ name, role: "cast", order })),
        // A non-Latin name never becomes an option.
        { name: "송강호", role: "cast", order: 9 },
      ],
    };
  });
};

describe("Duelo de trivia: the generator (FIL-I53-5)", () => {
  const films = pool();
  const byId = new Map(films.map((film) => [film.id, film]));

  it("every one of 200 generated questions has exactly one right option by the stored data", () => {
    let total = 0;
    const kinds = new Set<string>();
    for (let duel = 0; duel < 40; duel += 1) {
      const questions = generateTrivia(films, `semilla-${duel}`);
      assert.equal(questions.length, 5);
      assert.equal(new Set(questions.map((question) => question.catalogId ?? question.options.map((o) => o.catalogId).join())).size, 5);
      for (const question of questions) {
        assert.ok(isUnambiguous(question, byId), `ambiguous: ${JSON.stringify(question)}`);
        assert.ok(question.options.every((option) => !/[가-힣]/.test(option.label)));
        kinds.add(question.kind);
        total += 1;
      }
    }
    assert.equal(total, 200);
    assert.deepEqual([...kinds].sort(), [...TRIVIA_KINDS].sort());
  });

  it("the same seed gives the same questions; another seed, others", () => {
    assert.deepEqual(generateTrivia(films, "x"), generateTrivia([...films].reverse(), "x"));
    assert.notDeepEqual(generateTrivia(films, "x"), generateTrivia(films, "y"));
  });

  it("what reaches the client has no right answer", () => {
    for (const question of generateTrivia(films, "público")) {
      const shown = publicQuestion(question);
      assert.ok(!("correct" in shown));
      assert.deepEqual(Object.keys(shown).sort(), ["catalogId", "kind", "label", "options", "posterPath", "prompt"]);
    }
  });

  it("points: by speed up to 15 s on the server's clock, zero after or when wrong", () => {
    assert.equal(triviaPoints(true, 0), 100);
    assert.equal(triviaPoints(true, 5000), 83);
    assert.equal(triviaPoints(true, TRIVIA_MS), 50);
    assert.equal(triviaPoints(true, TRIVIA_MS + 1), 0);
    assert.equal(triviaPoints(false, 1000), 0);
  });
});
