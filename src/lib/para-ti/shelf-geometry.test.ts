import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SHELF_PHONE, SHELF_WINDOW, centerAt, mountedRange, scrollFor, spinePose, surpriseIndex } from "./shelf-geometry";

describe("spine shelf geometry (FIL-I60-5)", () => {
  it("turns only the centred box out, and its neighbours make room", () => {
    const centre = spinePose(0, SHELF_PHONE);
    assert.equal(centre.turn, 1);
    assert.equal(centre.rotateY, -90);
    assert.equal(centre.shift, 0);
    const right = spinePose(1, SHELF_PHONE);
    const left = spinePose(-2, SHELF_PHONE);
    assert.equal(right.turn, 0);
    assert.ok(right.shift > 0 && left.shift < 0);
    assert.equal(spinePose(3, SHELF_PHONE).shift, right.shift, "beyond one slot the push stays constant");
    const half = spinePose(0.5, SHELF_PHONE);
    assert.ok(half.turn > 0 && half.turn < 1, "the turn follows the scroll position");
  });

  it("leans spines with speed, never the centred cover, and within ±11°", () => {
    assert.equal(spinePose(0, SHELF_PHONE, 2).lean, 0);
    const fast = spinePose(2, SHELF_PHONE, 2, 1.6);
    assert.ok(Math.abs(fast.lean) <= 11 && fast.lean !== 0);
    assert.equal(spinePose(2, SHELF_PHONE, 0).lean, 0);
  });

  it("maps scroll to the centre slot and back", () => {
    assert.equal(centerAt(scrollFor(7, SHELF_PHONE), SHELF_PHONE), 7);
  });

  it("mounts at most 25 titles around the centre", () => {
    const { from, to } = mountedRange(20, 40);
    assert.equal(to - from + 1, 2 * SHELF_WINDOW + 1);
    assert.deepEqual(mountedRange(0, 40), { from: 0, to: SHELF_WINDOW });
    assert.deepEqual(mountedRange(3, 5), { from: 0, to: 4 });
  });

  it("«Sorpréndeme» lands mostly in the top third and never on the current title", () => {
    let seed = 1;
    const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const picks = Array.from({ length: 1000 }, () => surpriseIndex(30, 0, random));
    assert.ok(picks.every((pick) => pick >= 0 && pick < 30 && pick !== 0));
    const top = picks.filter((pick) => pick < 10).length;
    assert.ok(top > 650, `top third ${top}/1000`);
    assert.equal(surpriseIndex(1, 0), 0);
  });
});
