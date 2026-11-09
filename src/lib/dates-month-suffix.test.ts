import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { monthCountSuffix } from "@/lib/dates";

describe("monthCountSuffix (FIL-I44-10)", () => {
  const now = new Date("2026-11-08T18:00:00Z");

  it("says «este mes» only for the current month", () => {
    assert.equal(monthCountSuffix("2026-11", now), "este mes");
  });

  it("names another month of this year", () => {
    assert.equal(monthCountSuffix("2026-10", now), "en octubre");
  });

  it("adds the year for another year", () => {
    assert.equal(monthCountSuffix("2025-12", now), "en diciembre de 2025");
  });
});
