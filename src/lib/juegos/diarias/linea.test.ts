import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DIARIA_MIN_VOTES } from "@/lib/juegos/diarias/core";
import { buildLineaRound, fitsGap, gapLabel, LINEA_CARDS, LINEA_LIVES, lineaMarks, lineaState, type LineaCandidate } from "@/lib/juegos/diarias/linea";

/** Sixty films over only twenty years: plenty of same-year pairs to trip a careless generator. */
const pool: LineaCandidate[] = Array.from({ length: 60 }, (_, index) => ({
  id: `l${String(index).padStart(3, "0")}`,
  year: 1980 + (index % 20) * 2,
  posterPath: `/l${index}.jpg`,
  imdbVotes: DIARIA_MIN_VOTES + index,
}));

describe("Línea de tiempo: the round (FIL-I54-2)", () => {
  it("never has two films of the same year, over a thousand seeds", () => {
    for (let day = 0; day < 1000; day += 1) {
      const round = buildLineaRound({ pool, seed: `d${day}` })!;
      assert.equal(round.cards.length, LINEA_CARDS + 1);
      assert.equal(new Set(round.cards.map((card) => card.year)).size, round.cards.length, `seed d${day}`);
      assert.equal(new Set(round.cards.map((card) => card.catalogId)).size, round.cards.length);
    }
  });

  it("is the same for the same seed, whatever the pool's order", () => {
    assert.deepEqual(buildLineaRound({ pool, seed: "x" }), buildLineaRound({ pool: [...pool].reverse(), seed: "x" }));
  });

  it("is null when there are not nine distinct years", () => {
    assert.equal(buildLineaRound({ pool: pool.filter((film) => film.year! < 1996), seed: "x" }), null);
  });
});

describe("Línea de tiempo: placing a card (FIL-I54-2)", () => {
  const round = {
    cards: [
      { catalogId: "a", year: 1999 },
      { catalogId: "b", year: 1985 },
      { catalogId: "c", year: 2010 },
      { catalogId: "d", year: 1994 },
      { catalogId: "e", year: 2003 },
      { catalogId: "f", year: 1972 },
      { catalogId: "g", year: 2017 },
      { catalogId: "h", year: 1960 },
      { catalogId: "i", year: 2021 },
    ],
  };

  it("judges a gap against the line's neighbours", () => {
    const line = [{ year: 1985 }, { year: 1999 }];
    assert.ok(fitsGap(line, 0, 1972));
    assert.ok(fitsGap(line, 1, 1994));
    assert.ok(fitsGap(line, 2, 2003));
    assert.ok(!fitsGap(line, 0, 1994));
    assert.ok(!fitsGap(line, 2, 1994));
    assert.ok(!fitsGap(line, 3, 2003));
    assert.equal(gapLabel(line, 0), "Antes de 1985");
    assert.equal(gapLabel(line, 1), "Entre 1985 y 1999");
    assert.equal(gapLabel(line, 2), "Después de 1999");
  });

  it("a wrong gap costs a life and the card still lands in its real place", () => {
    // 1985 placed after 1999 (wrong).
    const state = lineaState(round, [{ c: 1, g: 1, ok: false }]);
    assert.equal(state.lives, LINEA_LIVES - 1);
    assert.deepEqual(
      state.placed.map((item) => [item.year, item.ok]),
      [
        [1985, false],
        [1999, null],
      ],
    );
    assert.equal(state.current, 2);
    assert.equal(state.score, 0);
  });

  it("three misses end the partida; eight placements end it too", () => {
    const lost = lineaState(round, [
      { c: 1, g: 0, ok: true },
      { c: 2, g: 0, ok: false },
      { c: 3, g: 0, ok: false },
      { c: 4, g: 0, ok: false },
      { c: 5, g: 0, ok: true },
    ]);
    assert.ok(lost.finished);
    assert.equal(lost.lives, 0);
    assert.equal(lost.marks.length, 4, "nothing counts after the last life");
    assert.equal(lineaMarks(lost), "🟩🟥🟥🟥");
    const all = lineaState(
      round,
      Array.from({ length: LINEA_CARDS }, (_, index) => ({ c: index + 1, g: 0, ok: true })),
    );
    assert.ok(all.finished);
    assert.equal(all.score, LINEA_CARDS);
    assert.equal(all.current, null);
  });
});
