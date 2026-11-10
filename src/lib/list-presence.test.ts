import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isRecentlyActive } from "./list-invites-core";

describe("isRecentlyActive (FIL-I46-3)", () => {
  it("is true only within the last two days", () => {
    const now = new Date("2026-11-09T20:00:00Z");
    assert.equal(isRecentlyActive("2026-11-09T08:00:00Z", now), true);
    assert.equal(isRecentlyActive(new Date("2026-11-07T21:00:00Z"), now), true);
    assert.equal(isRecentlyActive("2026-11-07T19:00:00Z", now), false);
    assert.equal(isRecentlyActive(null, now), false);
    assert.equal(isRecentlyActive("2026-11-10T08:00:00Z", now), false);
  });
});
