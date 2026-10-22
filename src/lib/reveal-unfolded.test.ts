import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { unfoldScrollDelta } from "./reveal-unfolded";

describe("unfoldScrollDelta", () => {
  it("does nothing when the unfolded row already ends above the dock", () => {
    assert.equal(unfoldScrollDelta({ rowTop: 300, rowBottom: 640, limitBottom: 756, minTop: 56 }), 0);
    assert.equal(unfoldScrollDelta({ rowTop: 300, rowBottom: 756, limitBottom: 756, minTop: 56 }), 0);
  });

  it("scrolls just enough for the bottom to land on the limit (ficha #2 at 390×844)", () => {
    // Row at 612, unfolded to 335 px: bottom 947 → 191 px over 756.
    assert.equal(unfoldScrollDelta({ rowTop: 612, rowBottom: 947, limitBottom: 756, minTop: 56 }), 191);
  });

  it("never pushes the row's head under the header", () => {
    // A row taller than the usable space: only the headroom above it is spent.
    assert.equal(unfoldScrollDelta({ rowTop: 120, rowBottom: 1000, limitBottom: 600, minTop: 56 }), 64);
    assert.equal(unfoldScrollDelta({ rowTop: 40, rowBottom: 1000, limitBottom: 600, minTop: 56 }), 0);
  });
});
