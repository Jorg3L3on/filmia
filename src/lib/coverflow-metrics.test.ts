import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clampCoverflowIndex,
  COVERFLOW_CARD_WIDTH,
  COVERFLOW_CARD_WIDTH_MAX_WIDE,
  COVERFLOW_CARD_WIDTH_MIN,
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
    assert.ok(center.brightness > side.brightness);
  });

  it("fits card width between the page min and max", () => {
    assert.equal(measureCoverflowCardWidth(1400, false, 700), COVERFLOW_CARD_WIDTH_MAX_WIDE);
    assert.equal(measureCoverflowCardWidth(850, false, 560), COVERFLOW_CARD_WIDTH);
    assert.ok(measureCoverflowCardWidth(200, false) >= COVERFLOW_CARD_WIDTH_MIN);
    assert.ok(measureCoverflowCardWidth(200, true) <= 156);
  });

  it("shrinks page cards when stage height is tight", () => {
    const wideButShort = measureCoverflowCardWidth(900, false, 240);
    assert.ok(wideButShort < COVERFLOW_CARD_WIDTH);
    assert.ok(wideButShort >= COVERFLOW_CARD_WIDTH_MIN);
  });
});
