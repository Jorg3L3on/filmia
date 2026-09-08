import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clampCoverflowIndex,
  getCoverflowCardMetrics,
  measureCoverflowCardWidth,
} from "./coverflow-metrics";

describe("coverflow metrics", () => {
  it("clamps the focused index to the deck", () => {
    assert.equal(clampCoverflowIndex(-2, 4), 0);
    assert.equal(clampCoverflowIndex(9, 4), 4);
    assert.equal(clampCoverflowIndex(2, 4), 2);
    assert.equal(clampCoverflowIndex(0, -1), 0);
  });

  it("marks the center card as active and dims far cards", () => {
    const center = getCoverflowCardMetrics(0, 120);
    const side = getCoverflowCardMetrics(2, 120);
    assert.equal(center.isActive, true);
    assert.equal(side.isActive, false);
    assert.ok(center.scale > side.scale);
    assert.ok(center.opacity >= side.opacity);
  });

  it("fits card width between the page min and max", () => {
    assert.equal(measureCoverflowCardWidth(800, false), 236);
    assert.ok(measureCoverflowCardWidth(200, false) >= 128);
    assert.ok(measureCoverflowCardWidth(200, true) <= 156);
  });
});
