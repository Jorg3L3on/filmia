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
