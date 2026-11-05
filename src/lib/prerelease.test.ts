import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isPrerelease } from "@/lib/cine-core";

describe("isPrerelease (UX-03)", () => {
  it("is true only for an upcoming premiere after today", () => {
    assert.equal(isPrerelease({ status: "upcoming", mxReleaseDate: "2026-11-12" }, "2026-11-05"), true);
    assert.equal(isPrerelease({ status: "upcoming", mxReleaseDate: "2026-11-05" }, "2026-11-05"), false);
    assert.equal(isPrerelease({ status: "now", mxReleaseDate: "2026-11-12" }, "2026-11-05"), false);
    assert.equal(isPrerelease(null, "2026-11-05"), false);
  });
});
