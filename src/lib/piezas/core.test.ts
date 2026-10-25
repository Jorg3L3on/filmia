import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  answerOfLens,
  impliedRatingLabel,
  pickVisteCards,
  rotateSeeds,
  sameMxDay,
  VISTE_RATING,
  visteLens,
  visteSummary,
} from "./core";

describe("el día", () => {
  it("turns the day at midnight in Mexico City", () => {
    // 05:59 UTC is 23:59 in Mexico City (UTC-6), 06:01 UTC is the next day there.
    assert.equal(sameMxDay(new Date("2026-10-23T05:59:00Z"), new Date("2026-10-22T18:00:00Z")), true);
    assert.equal(sameMxDay(new Date("2026-10-23T06:01:00Z"), new Date("2026-10-23T05:59:00Z")), false);
  });
});

describe("¿Las viste?", () => {
  it("one card per seed, the best known first, never one you have", () => {
    const cards = pickVisteCards(
      [
        { seedName: "PHM", candidates: [{ tmdbId: 1, voteCount: 30000 }, { tmdbId: 2, voteCount: 20000 }] },
        { seedName: "LOTR", candidates: [{ tmdbId: 3, voteCount: 10000 }, { tmdbId: 1, voteCount: 30000 }] },
        { seedName: "Michael", candidates: [{ tmdbId: 4, voteCount: 5000 }] },
      ],
      new Set([3]),
    );
    assert.deepEqual(
      cards.map((card) => [card.tmdbId, card.seedName]),
      [
        [1, "PHM"],
        [4, "Michael"],
        [2, "PHM"],
      ],
    );
  });

  it("each new batch starts one seed further along, so every film of yours gets a turn", () => {
    assert.deepEqual(rotateSeeds(["a", "b", "c"], 0), ["a", "b", "c"]);
    assert.deepEqual(rotateSeeds(["a", "b", "c"], 1), ["b", "c", "a"]);
    assert.deepEqual(rotateSeeds(["a", "b", "c"], 4), ["b", "c", "a"]);
    assert.deepEqual(rotateSeeds([], 2), []);
  });

  it("answers are events with what Afinidad reads", () => {
    assert.equal(visteLens("meh"), "viste:meh");
    assert.equal(answerOfLens("viste:liked"), "liked");
    assert.equal(answerOfLens("las-viste:PHM"), null);
    assert.ok(VISTE_RATING.liked >= 7, "«me gustó» counts as liked");
    assert.ok(VISTE_RATING.meh < 7, "«no tanto» counts as a negative");
  });

  it("an answer reads as words, never as stars", () => {
    assert.equal(impliedRatingLabel(VISTE_RATING.liked), "Te gustó");
    assert.equal(impliedRatingLabel(VISTE_RATING.meh), "No tanto");
    assert.equal(impliedRatingLabel(null), null);
  });

  it("closes with what changed, only gains", () => {
    assert.equal(
      visteSummary({ seen: 2, newPeople: ["Christopher Nolan", "Hans Zimmer", "Otro"], rutas: [{ shortTitle: "Lord & Miller", done: 2, total: 5 }] }),
      "Aparecieron Christopher Nolan y Hans Zimmer; Lord & Miller va 2 de 5.",
    );
    assert.equal(visteSummary({ seen: 1, newPeople: [], rutas: [] }), "Una más en tu diario.");
    assert.equal(visteSummary({ seen: 0, newPeople: [], rutas: [] }), "Ninguna de estas. Sigue con otras tres.");
  });
});
