import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  resolveStubCancel,
  resolveStubRelease,
  STUB_TAP_SLOP_PX,
  STUB_TEAR_PX,
} from "./stub-gesture";

describe("stub gesture (FIL-I21-1)", () => {
  it("counts a slide shorter than the slop as a tap", () => {
    for (const dy of [0, 3, 6, 11]) {
      assert.equal(resolveStubRelease(dy), "tap", `${dy} px should open the sheet`);
    }
    assert.equal(resolveStubRelease(STUB_TAP_SLOP_PX - 0.5), "tap");
  });

  it("springs back between the slop and the tear point", () => {
    for (const dy of [12, 20, 35, 59]) {
      assert.equal(resolveStubRelease(dy), "spring-back", `${dy} px should spring back`);
    }
  });

  it("tears at 60 px and beyond", () => {
    assert.equal(resolveStubRelease(STUB_TEAR_PX), "tear");
    assert.equal(resolveStubRelease(96), "tear");
  });

  it("ignores upward travel (still a tap)", () => {
    assert.equal(resolveStubRelease(-30), "tap");
  });

  it("never opens on pointercancel", () => {
    assert.equal(resolveStubCancel(), "reset");
  });

  it("keeps the agreed thresholds", () => {
    assert.equal(STUB_TAP_SLOP_PX, 12);
    assert.equal(STUB_TEAR_PX, 60);
  });
});
