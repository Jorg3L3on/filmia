import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildGrid,
  cellOf,
  CUADRICULA_MIN_ANSWERS,
  CUADRICULA_TRIES,
  gridMarks,
  gridState,
  hasDistinctAnswers,
  judgeCell,
  RARITY_MIN_PLAYERS,
  rarityOf,
  rarityScore,
  validFilms,
  type GridFilm,
  type GridPerson,
} from "@/lib/juegos/diarias/cuadricula";

const GENRES = [18, 35, 28, 878, 53, 80, 12, 10749, 14, 16];

/**
 * Fixed fictitious people: each has `count` films spread over 1975–2024, rotating genres,
 * runtimes and ratings; films are shared between people at the edges so the same film can be
 * valid in two cells (what the «never twice» rule is about).
 */
const person = (id: number, count: number, offset: number, role: GridPerson["role"] = "cast"): GridPerson => ({
  id,
  name: `Persona ${id}`,
  role,
  films: Array.from({ length: count }, (_, index): GridFilm => {
    const n = index + offset;
    return {
      t: 10_000 + n,
      n: `Película ${n}`,
      y: 1975 + ((n * 7) % 50),
      g: [GENRES[n % GENRES.length]!, GENRES[(n * 3 + 1) % GENRES.length]!],
      r: 85 + ((n * 13) % 90),
      i: 5 + ((n * 17) % 45) / 10,
      k: n % 5 !== 0,
      p: null,
    };
  }),
});

const people = Array.from({ length: 8 }, (_, index) => person(index + 1, 30 + index * 6, index * 20, index % 3 === 0 ? "director" : "cast"));

describe("La cuadrícula: the generator (FIL-I54-4)", () => {
  it("every generated grid has three or more valid well-known films in every cell, over 300 seeds", () => {
    let made = 0;
    for (let day = 0; day < 300; day += 1) {
      const round = buildGrid({ people, seed: `d${day}` });
      if (!round) continue;
      made += 1;
      assert.equal(round.rows.length, 3);
      assert.equal(new Set(round.rows.map((row) => row.id)).size, 3);
      assert.equal(new Set(round.cols).size, 3);
      const cells = Array.from({ length: 9 }, (_, cell) => {
        const { person: who, condition } = cellOf(round, cell)!;
        const known = validFilms(who, condition, true);
        assert.ok(known.length >= CUADRICULA_MIN_ANSWERS, `seed d${day} cell ${cell}: ${known.length}`);
        return known.map((film) => film.t);
      });
      assert.ok(hasDistinctAnswers(cells), `seed d${day}: nine distinct answers possible`);
    }
    assert.ok(made >= 290, `grids made: ${made}`);
  });

  it("is the same for the same seed and people, in any order", () => {
    assert.deepEqual(buildGrid({ people, seed: "x" }), buildGrid({ people: [...people].reverse(), seed: "x" }));
  });

  it("is null when nobody has enough films", () => {
    assert.equal(buildGrid({ people: people.map((p) => ({ ...p, films: p.films.slice(0, 4) })), seed: "x" }), null);
  });

  it("the matching notices when cells can only share one film", () => {
    assert.ok(hasDistinctAnswers([[1, 2], [2, 3], [1, 3]]));
    assert.ok(!hasDistinctAnswers([[1], [1], [2]]));
  });
});

describe("La cuadrícula: answers (FIL-I54-4)", () => {
  const round = buildGrid({ people, seed: "fija" })!;
  const answerFor = (cell: number, skip: ReadonlySet<number> = new Set()) => {
    const { person: who, condition } = cellOf(round, cell)!;
    return validFilms(who, condition).find((film) => !skip.has(film.t))!;
  };

  it("the same film is not accepted in two cells", () => {
    // Find a film that is valid in two different cells.
    let shared: { a: number; b: number; t: number } | null = null;
    for (let a = 0; a < 9 && !shared; a += 1) {
      for (let b = a + 1; b < 9 && !shared; b += 1) {
        const inA = new Set(validFilms(cellOf(round, a)!.person, cellOf(round, a)!.condition).map((film) => film.t));
        const both = validFilms(cellOf(round, b)!.person, cellOf(round, b)!.condition).find((film) => inA.has(film.t));
        if (both) shared = { a, b, t: both.t };
      }
    }
    assert.ok(shared, "the fixed data has a film valid in two cells");
    const first = judgeCell(round, [], shared.a, shared.t);
    assert.equal(first.kind, "right");
    const answers = [{ c: shared.a, t: shared.t, n: "x", ok: true }];
    assert.equal(judgeCell(round, answers, shared.b, shared.t).kind, "repeated");
    assert.equal(judgeCell(round, answers, shared.a, answerFor(shared.a, new Set([shared.t])).t).kind, "taken");
  });

  it("a film of someone else, or that misses the condition, is wrong; missing data is not counted", () => {
    assert.equal(judgeCell(round, [], 0, 1).kind, "wrong");
    const { person: who, condition } = cellOf(round, 0)!;
    const off = who.films.find((film) => condition.test(film) === false);
    if (off) assert.equal(judgeCell(round, [], 0, off.t).kind, "wrong");
    const runtime = { ...round, cols: ["dura:140", round.cols[1]!, round.cols[2]!] };
    const blank = { ...round.rows[0]!.films[0]!, t: 1, r: null };
    const withBlank = { ...runtime, rows: [{ ...round.rows[0]!, films: [...round.rows[0]!.films, blank] }, round.rows[1]!, round.rows[2]!] };
    assert.equal(judgeCell(withBlank, [], 0, 1).kind, "unknown");
  });

  it("nine tries, right or wrong; nine filled ends it early", () => {
    const wrong = Array.from({ length: CUADRICULA_TRIES + 2 }, () => ({ c: 0, t: 1, n: "x", ok: false }));
    const lost = gridState(wrong);
    assert.equal(lost.tries, CUADRICULA_TRIES);
    assert.ok(lost.finished);
    const used = new Set<number>();
    const all = Array.from({ length: 9 }, (_, cell) => {
      const film = answerFor(cell, used);
      used.add(film.t);
      return { c: cell, t: film.t, n: film.n, ok: true };
    });
    const won = gridState(all);
    assert.equal(won.score, 9);
    assert.ok(won.finished);
    assert.equal(gridMarks([0, 4, 8]), "🟩⬜⬜\n⬜🟩⬜\n⬜⬜🟩");
  });
});

describe("La cuadrícula: rarity (FIL-I54-4)", () => {
  const cells = (pairs: Array<[number, number]>) => new Map(pairs);

  it("with fewer than five players there is no percentage", () => {
    const four = [cells([[0, 1]]), cells([[0, 1]]), cells([[0, 2]]), cells([])];
    assert.equal(RARITY_MIN_PLAYERS, 5);
    assert.equal(rarityOf(four, 0, 1), null);
    assert.equal(rarityScore(four, four[0]!), null);
  });

  it("from five players: the share who gave the same film, and the sum with 100 per empty cell", () => {
    const five = [cells([[0, 1]]), cells([[0, 1]]), cells([[0, 2]]), cells([[0, 1]]), cells([[1, 3]])];
    assert.equal(rarityOf(five, 0, 1), 60);
    assert.equal(rarityOf(five, 0, 2), 20);
    assert.equal(rarityScore(five, five[2]!), 20 + 8 * 100);
  });
});
