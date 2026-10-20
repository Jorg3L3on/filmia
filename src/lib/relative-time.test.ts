import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { relativeTimeEs } from "./relative-time";

const NOW = new Date("2026-10-20T18:00:00Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms);

describe("relativeTimeEs", () => {
  it("minutes, hours, days", () => {
    assert.equal(relativeTimeEs(ago(10_000), NOW), "hace un momento");
    assert.equal(relativeTimeEs(ago(2 * 60_000), NOW), "hace 2 min");
    assert.equal(relativeTimeEs(ago(3 * 3_600_000), NOW), "hace 3 h");
    assert.equal(relativeTimeEs(ago(30 * 3_600_000), NOW), "ayer");
    assert.equal(relativeTimeEs(ago(3 * 86_400_000), NOW), "hace 3 días");
  });

  it("a date after a week", () => {
    assert.equal(relativeTimeEs(new Date("2026-10-12T18:00:00Z"), NOW), "el 12 oct");
  });
});
