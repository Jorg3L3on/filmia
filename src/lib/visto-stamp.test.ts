import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { vistoStampLabel } from "./visto-stamp";

describe("vistoStampLabel (FIL-I46-5)", () => {
  it("reads like a rubber stamp", () => {
    assert.equal(vistoStampLabel(new Date(2026, 10, 9, 23, 30)), "VISTA · 9 nov");
    assert.equal(vistoStampLabel(new Date(2026, 0, 31)), "VISTA · 31 ene");
  });
});
