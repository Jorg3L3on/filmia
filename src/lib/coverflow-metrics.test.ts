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

  it("soft-coverflow fans left and right with blur + depth", () => {
    const center = getCoverflowCardMetrics(0, 160, false, true);
    const left = getCoverflowCardMetrics(-1.2, 160, false, true);
    const right = getCoverflowCardMetrics(1.2, 160, false, true);
    const farRight = getCoverflowCardMetrics(2.4, 160, false, true);

    assert.equal(center.isActive, true);
    assert.equal(center.blur, 0);
    assert.ok(Math.abs(center.rotateY) < 1e-9);

    // True L+R fan: opposite rotateY toward center, both scaled/dimmed/blurred.
    assert.ok(left.rotateY > 0);
    assert.ok(right.rotateY < 0);
    assert.ok(Math.abs(left.rotateY + right.rotateY) < 0.001);
    assert.ok(left.translateX < 0);
    assert.ok(right.translateX > 0);
    assert.ok(left.translateZ < 0);
    assert.ok(right.translateZ < 0);
    assert.ok(left.blur > 0);
    assert.ok(right.blur > 0);
    assert.ok(farRight.blur >= right.blur);
    assert.ok(center.scale > right.scale);
    assert.ok(center.brightness > right.brightness);

    // Even at index=0 (only positive offsets), neighbors still fan — not a flat stack.
    const edgeNeighbor = getCoverflowCardMetrics(1, 160, false, true);
    assert.ok(edgeNeighbor.translateX > 40);
    assert.ok(Math.abs(edgeNeighbor.rotateY) > 28);
    assert.ok(edgeNeighbor.translateZ < -70);
    assert.ok(center.scale - right.scale > 0.12);
    assert.ok(edgeNeighbor.blur > 0);
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

  it("grows cinematic hero while leaving room for the L+R fan", () => {
    const phone = measureCoverflowCardWidth(358, false, 400, true);
    assert.ok(phone >= 220, `phone hero too small: ${phone}`);
    assert.ok(phone <= 358 * 0.72);

    const cinematic = measureCoverflowCardWidth(1000, false, 560, true);
    assert.ok(cinematic >= 300, `desktop hero too small: ${cinematic}`);
    assert.ok(cinematic < 1000 * 0.45);
  });
});
