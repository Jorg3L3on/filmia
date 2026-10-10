import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evalKey, mean, poolRecall, recallAtK, splitHoldout } from "./tonight/eval";

const day = (offset: number) => new Date(2026, 0, 1 + offset);
const watched = (id: string, rating: number | null, offset: number) => ({
  id,
  rating,
  watchedAt: day(offset),
});

describe("tonight/eval", () => {
  it("hides the most recent well-rated watches and keeps the rest", () => {
    const titles = [
      ...Array.from({ length: 10 }, (_, index) => watched(`t${index}`, 9, index)),
      watched("low", 4, 20),
      { id: "queued", rating: null, watchedAt: null },
    ];
    const split = splitHoldout(titles);
    assert.ok(split);
    assert.deepEqual(
      split.holdout.map((title) => title.id),
      ["t9", "t8"],
    );
    assert.equal(split.train.length, titles.length - 2);
    assert.ok(split.train.some((title) => title.id === "low"));
  });

  it("skips users with too few rated watches", () => {
    const titles = Array.from({ length: 7 }, (_, index) => watched(`t${index}`, 9, index));
    assert.equal(splitHoldout(titles), null);
  });

  it("skips users without enough well-rated titles to hide and still train on", () => {
    const titles = [
      ...Array.from({ length: 2 }, (_, index) => watched(`hi${index}`, 9, index)),
      ...Array.from({ length: 8 }, (_, index) => watched(`lo${index}`, 3, 10 + index)),
    ];
    assert.equal(splitHoldout(titles), null);
  });

  it("caps the hold-out at eight", () => {
    const titles = Array.from({ length: 80 }, (_, index) => watched(`t${index}`, 9, index));
    assert.equal(splitHoldout(titles)?.holdout.length, 8);
  });

  it("computes recall at k and pool recall", () => {
    const hidden = new Set(["a", "b", "c", "d"]);
    assert.equal(recallAtK(["x", "a", "y", "b"], hidden, 2), 0.25);
    assert.equal(recallAtK(["x", "a", "y", "b"], hidden, 10), 0.5);
    assert.equal(recallAtK([], new Set(), 10), 0);
    assert.equal(poolRecall(new Set(["a", "z"]), hidden), 0.25);
  });

  it("keys a title by kind and tmdb id, and averages", () => {
    assert.equal(evalKey("MOVIE", 603), "MOVIE:603");
    assert.equal(mean([]), 0);
    assert.equal(mean([1, 3]), 2);
  });
});
