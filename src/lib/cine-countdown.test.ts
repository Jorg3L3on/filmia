import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { countdownLabel, daysUntilPremiere, mxToday } from "./cine-core";

describe("premiere countdown (FIL-I46-4)", () => {
  // A fixed clock: 9 Nov 2026, 22:30 in Mexico City (04:30 UTC the next day).
  const today = mxToday(new Date("2026-11-10T04:30:00Z"));

  it("counts calendar days in Mexico City", () => {
    assert.equal(today, "2026-11-09");
    assert.equal(daysUntilPremiere("2026-11-09", today), 0);
    assert.equal(daysUntilPremiere("2026-11-10", today), 1);
    assert.equal(daysUntilPremiere("2026-11-21", today), 12);
  });

  it("reads hoy, mañana and en 12 días; nothing after the premiere", () => {
    assert.equal(countdownLabel("2026-11-09", today), "Hoy");
    assert.equal(countdownLabel("2026-11-10", today), "Mañana");
    assert.equal(countdownLabel("2026-11-21", today), "En 12 días");
    assert.equal(countdownLabel("2026-11-08", today), null);
  });
});
