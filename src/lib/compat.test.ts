import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  COMPAT_MIN_COMMON,
  compatibility,
  compatLabel,
  groupCompatibility,
  percentOf,
  ranks,
  shrink,
  spearman,
  type CompatPerson,
} from "./compat";
import { AFFINITY_MIN_RATED } from "./tonight/affinity";

const person = (ratings: [string, number][], vector: [string, number][] = [["g:18", 1]]): CompatPerson => ({
  ratings: new Map(ratings),
  vector: new Map(vector),
});

const films = (n: number, rate: (i: number) => number, prefix = "c") =>
  Array.from({ length: n }, (_, i): [string, number] => [`${prefix}${i}`, rate(i)]);

describe("compat · Spearman", () => {
  it("ranks ties with their mean position", () => {
    assert.deepEqual(ranks([7, 9, 7, 3]), [2.5, 4, 2.5, 1]);
  });

  it("perfect, inverse and unrelated orders", () => {
    assert.equal(spearman([1, 2, 3, 4, 5], [2, 4, 6, 8, 10]), 1);
    assert.equal(spearman([1, 2, 3, 4, 5], [10, 8, 6, 4, 2]), -1);
    assert.ok(Math.abs(spearman([1, 2, 3, 4, 5, 6], [3, 6, 1, 5, 2, 4])) < 0.3);
  });

  it("ties do not break it and a flat rater correlates with nobody", () => {
    const r = spearman([8, 8, 6, 6, 10, 4], [9, 9, 5, 7, 10, 3]);
    assert.ok(r > 0.8 && r <= 1);
    assert.equal(spearman([7, 7, 7, 7], [1, 5, 9, 3]), 0);
  });
});

describe("compat · the %", () => {
  it("shrinks by how many films back it and stays in 5–95 by 5", () => {
    assert.equal(shrink(1, 10), 0.5);
    assert.equal(percentOf(1), 95);
    assert.equal(percentOf(-1), 5);
    assert.equal(percentOf(0.44), 70);
    assert.equal(percentOf(shrink(1, 8)), 70);
    for (const r of [-1, -0.37, 0, 0.12, 0.81, 1]) {
      const p = percentOf(r);
      assert.equal(p % 5, 0);
      assert.ok(p >= 5 && p <= 95);
    }
  });

  it("the minimum in common is AFFINITY_MIN_RATED", () => {
    assert.equal(COMPAT_MIN_COMMON, AFFINITY_MIN_RATED);
    assert.equal(COMPAT_MIN_COMMON, 8);
  });

  it("same taste on 12 films in common → high, shrunk, not approximate", () => {
    const a = person(films(12, (i) => 2 + (i % 9)));
    const b = person(films(12, (i) => 2 + (i % 9)));
    const compat = compatibility(a, b)!;
    assert.equal(compat.approx, false);
    assert.equal(compat.common, 12);
    assert.equal(compat.percent, percentOf(shrink(1, 12)));
    assert.ok(compat.percent < 95, "12 films never prove a perfect match");
  });

  it("opposite taste → low", () => {
    const a = person(films(12, (i) => 1 + (i % 10)));
    const b = person(films(12, (i) => 10 - (i % 10)));
    const compat = compatibility(a, b)!;
    assert.ok(compat.percent <= 30);
    assert.equal(compat.disagree != null, true);
  });

  it("under 8 in common → profile fallback with «~»", () => {
    const own = films(10, () => 8, "a");
    const shared = films(5, (i) => 6 + i, "s");
    const a = person([...own, ...shared], [["g:18", 1], ["g:35", 0.5]]);
    const b = person([...films(10, () => 7, "b"), ...shared], [["g:18", 1], ["g:35", 0.4]]);
    const compat = compatibility(a, b)!;
    assert.equal(compat.approx, true);
    assert.equal(compat.common, 5);
    assert.ok(compat.percent >= 90);
    assert.equal(compatLabel(compat), `~${compat.percent} %`);
  });

  it("a thin profile (< AFFINITY_MIN_RATED rated) shows nothing", () => {
    const a = person(films(AFFINITY_MIN_RATED - 1, () => 8));
    const b = person(films(20, () => 8));
    assert.equal(compatibility(a, b), null);
    assert.equal(compatibility(b, a), null);
  });

  it("both-love lists the films both rated ≥ 4★, best first", () => {
    const a = person([...films(8, (i) => 4 + (i % 6)), ["x", 10], ["y", 9]]);
    const b = person([...films(8, (i) => 4 + (i % 6)), ["x", 10], ["y", 8]]);
    const compat = compatibility(a, b)!;
    // x (10/10), c5 (9/9), then y (9/8) ahead of c4 (8/8) on the sum.
    assert.deepEqual(compat.bothLove, ["x", "c5", "y"]);
  });

  it("the group is the mean of its pairs", () => {
    const pair = (percent: number, approx = false) => ({
      percent,
      approx,
      common: 9,
      bothLove: [],
      disagree: null,
      sharedGenreIds: [],
    });
    assert.deepEqual(groupCompatibility([pair(70), pair(50), null]), { percent: 60, approx: false, pairs: 2 });
    assert.equal(groupCompatibility([null, null]), null);
    assert.equal(groupCompatibility([pair(70), pair(45, true)])!.approx, true);
  });
});
