import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  evalKey,
  hitsAtK,
  librarySignature,
  mean,
  poolHits,
  poolRecall,
  recallAtK,
  splitFolds,
} from "./tonight/eval";

const day = (offset: number) => new Date(2026, 0, 1 + offset);
const watched = (id: string, rating: number | null, offset: number) => ({
  id,
  rating,
  watchedAt: day(offset),
});

describe("tonight/eval", () => {
  it("hides every well-rated watch exactly once across folds", () => {
    const titles = [
      ...Array.from({ length: 9 }, (_, index) => watched(`t${index}`, 9, index)),
      watched("low", 4, 20),
      { id: "queued", rating: null, watchedAt: null },
    ];
    const folds = splitFolds(titles, 3);
    assert.equal(folds.length, 3);
    const hidden = folds.flatMap((fold) => fold.holdout.map((title) => title.id));
    assert.equal(new Set(hidden).size, 9);
    for (const fold of folds) {
      assert.equal(fold.holdout.length, 3);
      assert.ok(fold.train.some((title) => title.id === "low"));
      assert.ok(fold.train.some((title) => title.id === "queued"));
      assert.ok(fold.holdout.every((title) => !fold.train.includes(title)));
    }
  });

  it("skips users with too few rated watches", () => {
    const titles = Array.from({ length: 7 }, (_, index) => watched(`t${index}`, 9, index));
    assert.deepEqual(splitFolds(titles), []);
  });

  it("skips users without enough well-rated titles to hide", () => {
    const titles = [
      watched("hi", 9, 0),
      ...Array.from({ length: 8 }, (_, index) => watched(`lo${index}`, 3, 10 + index)),
    ];
    assert.deepEqual(splitFolds(titles), []);
  });

  it("shrinks the fold count and caps each hold-out at eight", () => {
    const few = Array.from({ length: 8 }, (_, index) => watched(`t${index}`, 9, index));
    assert.equal(splitFolds(few, 5).length, 4);
    const many = Array.from({ length: 80 }, (_, index) => watched(`t${index}`, 9, index));
    assert.ok(splitFolds(many, 3).every((fold) => fold.holdout.length === 8));
  });

  it("computes recall at k and pool recall", () => {
    const hidden = new Set(["a", "b", "c", "d"]);
    assert.equal(recallAtK(["x", "a", "y", "b"], hidden, 2), 0.25);
    assert.equal(recallAtK(["x", "a", "y", "b"], hidden, 10), 0.5);
    assert.equal(recallAtK([], new Set(), 10), 0);
    assert.equal(poolRecall(new Set(["a", "z"]), hidden), 0.25);
    assert.equal(hitsAtK(["x", "a", "b"], hidden, 3), 2);
    assert.equal(poolHits(new Set(["a", "b", "z"]), hidden), 2);
    assert.equal(librarySignature(["b", "a"]), librarySignature(["a", "b"]));
  });

  it("keys a title by kind and tmdb id, and averages", () => {
    assert.equal(evalKey("MOVIE", 603), "MOVIE:603");
    assert.equal(mean([]), 0);
    assert.equal(mean([1, 3]), 2);
  });
});
