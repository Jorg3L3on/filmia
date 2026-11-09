import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { endsAtLabel, pickDoubleFeature } from "./double-feature";

const at = (hh: number, mm: number) => new Date(2026, 10, 9, hh, mm, 0, 0);

describe("endsAtLabel (FIL-I46-2)", () => {
  it("is the fixed clock plus the runtime", () => {
    assert.equal(endsAtLabel(at(21, 15), 152), "Termina 23:47");
    assert.equal(endsAtLabel(at(23, 30), 95), "Termina 01:05");
  });

  it("renders nothing without a runtime or a clock", () => {
    assert.equal(endsAtLabel(at(21, 15), null), null);
    assert.equal(endsAtLabel(at(21, 15), 0), null);
    assert.equal(endsAtLabel(null, 120), null);
  });
});

describe("pickDoubleFeature (FIL-I46-2)", () => {
  const queue = [
    { id: "a", runtimeMinutes: 150 },
    { id: "b", runtimeMinutes: null },
    { id: "c", runtimeMinutes: 88 },
    { id: "d", runtimeMinutes: 70 },
  ];

  it("fits: the first queue title whose sum ends before bedtime", () => {
    // 200 min left: 100 + 10 break leaves 90 → «a» (150) no, «b» unknown, «c» (88) yes.
    const pick = pickDoubleFeature({ current: { id: "x", runtimeMinutes: 100 }, candidates: queue, remainingMinutes: 200 });
    assert.equal(pick?.id, "c");
    assert.ok(100 + 10 + (pick?.runtimeMinutes ?? 0) <= 200);
  });

  it("does not fit: nothing short enough, nothing shown", () => {
    assert.equal(pickDoubleFeature({ current: { id: "x", runtimeMinutes: 120 }, candidates: queue, remainingMinutes: 180 }), null);
  });

  it("without a bedtime (or the current runtime) there is no double feature", () => {
    assert.equal(pickDoubleFeature({ current: { id: "x", runtimeMinutes: 90 }, candidates: queue, remainingMinutes: null }), null);
    assert.equal(pickDoubleFeature({ current: { id: "x", runtimeMinutes: null }, candidates: queue, remainingMinutes: 400 }), null);
  });

  it("never proposes the same film twice", () => {
    const pick = pickDoubleFeature({ current: { id: "c", runtimeMinutes: 88 }, candidates: queue, remainingMinutes: 400 });
    assert.equal(pick?.id, "a");
  });
});

import { DOUBLE_FEATURE_BREAK_MINUTES, pickMarathon } from "./double-feature";

describe("pickMarathon (FIL-I46-3)", () => {
  const view = [
    { id: "a", runtimeMinutes: 95, kind: "MOVIE" },
    { id: "s", runtimeMinutes: 45, kind: "SERIES" },
    { id: "b", runtimeMinutes: 180, kind: "MOVIE" },
    { id: "c", runtimeMinutes: 88, kind: "MOVIE" },
    { id: "u", runtimeMinutes: null, kind: "MOVIE" },
    { id: "d", runtimeMinutes: 70, kind: "MOVIE" },
  ];

  it("never proposes a sum past bedtime, for any night length", () => {
    for (let remaining = 0; remaining <= 600; remaining += 7) {
      const pick = pickMarathon({ candidates: view, remainingMinutes: remaining, now: at(20, 0) });
      if (!pick) continue;
      const sum = pick.items.reduce((total, item) => total + (item.runtimeMinutes ?? 0), 0) + (pick.items.length - 1) * DOUBLE_FEATURE_BREAK_MINUTES;
      assert.equal(pick.totalMinutes, sum);
      assert.ok(sum <= remaining, `${sum} ≤ ${remaining}`);
      assert.ok(pick.items.length >= 2 && pick.items.length <= 3);
      assert.ok(pick.items.every((item) => item.kind !== "SERIES" && item.runtimeMinutes));
    }
  });

  it("keeps the view's order and says when it ends", () => {
    const pick = pickMarathon({ candidates: view, remainingMinutes: 280, now: at(20, 0) });
    assert.deepEqual(pick?.items.map((item) => item.id), ["a", "c", "d"]);
    assert.equal(pick?.totalMinutes, 95 + 10 + 88 + 10 + 70);
    assert.equal(pick?.endsAt, "00:33");
  });

  it("disappears without a bedtime, a clock, or room for two", () => {
    assert.equal(pickMarathon({ candidates: view, remainingMinutes: null, now: at(20, 0) }), null);
    assert.equal(pickMarathon({ candidates: view, remainingMinutes: 300, now: null }), null);
    assert.equal(pickMarathon({ candidates: view, remainingMinutes: 120, now: at(20, 0) }), null);
  });
});
