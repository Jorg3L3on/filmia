import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildSequence,
  DAILY_LENS_ROTATION,
  dailyLensOf,
  dailyNumber,
  dayStreak,
  filmsFor,
  isPlayable,
  MAYOR_LENSES,
  MAYOR_LENS_IDS,
  MAYOR_MIN_VOTES,
  shareText,
  squaresOf,
  stepIds,
  stepsOf,
  truthOf,
  type MayorCandidate,
} from "@/lib/juegos/mayor/core";
import { seededRandom, seededShuffle } from "@/lib/juegos/seed";

/** A fictitious pool: 80 films with spread-out numbers and a few deliberate ties. */
const pool: MayorCandidate[] = Array.from({ length: 80 }, (_, index) => ({
  id: `c${String(index).padStart(3, "0")}`,
  name: `Película ${index}`,
  posterPath: `/p${index}.jpg`,
  imdbRating: 5 + ((index * 7) % 40) / 10,
  imdbVotes: MAYOR_MIN_VOTES + index * 1000,
  year: 1970 + ((index * 13) % 55),
  runtimeMinutes: 80 + ((index * 11) % 90),
  rtScore: (index * 17) % 101,
}));

describe("seeded randomness (FIL-I52-1)", () => {
  it("is the same for the same seed and differs for another", () => {
    const a = seededRandom("x");
    const b = seededRandom("x");
    const c = seededRandom("y");
    const first = [a(), a(), a()];
    assert.deepEqual(first, [b(), b(), b()]);
    assert.notDeepEqual(first, [c(), c(), c()]);
    assert.ok(first.every((value) => value >= 0 && value < 1));
  });

  it("shuffles without losing or duplicating", () => {
    const shuffled = seededShuffle([1, 2, 3, 4, 5, 6], "s");
    assert.deepEqual([...shuffled].sort(), [1, 2, 3, 4, 5, 6]);
  });
});

describe("Mayor o menor sequence (FIL-I52-1)", () => {
  for (const lens of MAYOR_LENS_IDS) {
    it(`${lens}: the same seed and lens give the same sequence in two runs`, () => {
      const first = buildSequence({ pool, lens, seed: "2026-11-13", length: 30 });
      const second = buildSequence({ pool: [...pool].reverse(), lens, seed: "2026-11-13", length: 30 });
      assert.deepEqual(first, second);
      assert.notDeepEqual(first, buildSequence({ pool, lens, seed: "2026-11-14", length: 30 }));
    });

    it(`${lens}: no neighbouring pair ties and no film repeats in a sequence of 30`, () => {
      const sequence = buildSequence({ pool, lens, seed: `seed-${lens}`, length: 30 });
      assert.equal(sequence.length, 30);
      assert.equal(new Set(sequence).size, 30);
      const byId = new Map(pool.map((film) => [film.id, film]));
      for (let index = 0; index < stepsOf(sequence, lens); index += 1) {
        const [left, right] = stepIds(sequence, lens, index)!;
        assert.notEqual(truthOf(lens, byId.get(left)!, byId.get(right)!), null, `step ${index} ties`);
      }
    });
  }

  it("each lens only uses films with that number, a poster and enough votes (FIL-I52-5)", () => {
    const holes: MayorCandidate[] = [
      ...pool,
      { ...pool[0]!, id: "z-no-rating", imdbRating: null },
      { ...pool[1]!, id: "z-no-year", year: null },
      { ...pool[2]!, id: "z-no-runtime", runtimeMinutes: null },
      { ...pool[3]!, id: "z-no-rt", rtScore: null },
      { ...pool[4]!, id: "z-no-poster", posterPath: null },
      { ...pool[5]!, id: "z-obscure", imdbVotes: MAYOR_MIN_VOTES - 1 },
    ];
    for (const lens of MAYOR_LENS_IDS) {
      const sequence = buildSequence({ pool: holes, lens, seed: "todo", length: 200 });
      const byId = new Map(holes.map((film) => [film.id, film]));
      for (const id of sequence) {
        const film = byId.get(id)!;
        assert.ok(isPlayable(film, MAYOR_LENSES[lens]), `${lens} took ${id}`);
        assert.notEqual(MAYOR_LENSES[lens].valueOf(film), null);
      }
      assert.ok(!sequence.includes("z-no-poster") && !sequence.includes("z-obscure"));
    }
    assert.ok(!buildSequence({ pool: holes, lens: "critica", seed: "x", length: 200 }).includes("z-no-rt"));
    assert.ok(!buildSequence({ pool: holes, lens: "year", seed: "x", length: 200 }).includes("z-no-year"));
    assert.ok(!buildSequence({ pool: holes, lens: "runtime", seed: "x", length: 200 }).includes("z-no-runtime"));
  });

  it("the critics lens leaves out a film whose two scores tie", () => {
    const tie = { ...pool[0]!, id: "tie", imdbRating: 7.4, rtScore: 74 };
    assert.equal(MAYOR_LENSES.critica.valueOf(tie), null);
    assert.equal(truthOf("critica", tie, { ...tie, rtScore: 90 }), "mayor");
  });

  it("stops short when the pool runs out, never repeating", () => {
    const sequence = buildSequence({ pool: pool.slice(0, 5), lens: "imdb", seed: "s", length: 30 });
    assert.ok(sequence.length <= 5);
    assert.equal(new Set(sequence).size, sequence.length);
  });

  it("pairs chain: the right film of a step is the left of the next", () => {
    const sequence = ["a", "b", "c"];
    assert.deepEqual(stepIds(sequence, "imdb", 0), ["a", "b"]);
    assert.deepEqual(stepIds(sequence, "imdb", 1), ["b", "c"]);
    assert.equal(stepIds(sequence, "imdb", 2), null);
    assert.deepEqual(stepIds(sequence, "critica", 2), ["c", "c"]);
    assert.equal(filmsFor(10, "imdb"), 11);
    assert.equal(filmsFor(10, "critica"), 10);
  });
});

describe("the daily helpers (FIL-I52-3/4)", () => {
  it("numbers days from the first one", () => {
    assert.equal(dailyNumber("2026-11-13"), 1);
    assert.equal(dailyNumber("2026-12-05"), 23);
  });

  it("the daily's lens is a pure function of the day: the same for everyone, rotating through all four (FIL-I52-5)", () => {
    assert.equal(dailyLensOf("2026-11-13"), "imdb");
    assert.equal(dailyLensOf("2026-11-14"), "year");
    assert.equal(dailyLensOf("2026-11-16"), "runtime");
    assert.equal(dailyLensOf("2026-11-18"), "critica");
    assert.equal(dailyLensOf("2026-11-19"), dailyLensOf("2026-11-13"));
    const week = Array.from({ length: DAILY_LENS_ROTATION.length }, (_, index) => dailyLensOf(`2026-12-${String(index + 1).padStart(2, "0")}`));
    assert.deepEqual(new Set(week), new Set(MAYOR_LENS_IDS));
    assert.equal(dailyLensOf("2026-11-01"), DAILY_LENS_ROTATION[(((-12 % 6) + 6) % 6)], "days before n.º 1 still rotate");
  });

  it("counts days in a row ending today or yesterday", () => {
    assert.equal(dayStreak(["2026-11-13", "2026-11-12", "2026-11-11", "2026-11-09"], "2026-11-13"), 3);
    assert.equal(dayStreak(["2026-11-12", "2026-11-11"], "2026-11-13"), 2);
    assert.equal(dayStreak(["2026-11-10"], "2026-11-13"), 0);
  });

  it("the shared text names no film and no value", () => {
    const text = shareText({ day: "2026-11-20", lens: "imdb", answers: [true, false, true], url: "https://filmia.app/extras" });
    assert.equal(text, "Filmia · Mayor o menor n.º 8 · IMDb\n2 de 3\n🟩🟥🟩\nhttps://filmia.app/extras");
    assert.equal(squaresOf([]), "");
  });
});
