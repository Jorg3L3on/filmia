import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { needsRecoRefill, RECO_REFILL_BELOW, RECO_REFILL_COOLDOWN_MS, RECO_REFILL_FRESH_MS } from "./reco-refill";

const now = new Date("2026-10-23T20:00:00Z");
const ago = (ms: number) => new Date(now.getTime() - ms);

describe("Recomendaciones sin esperar al cron (FIL-26)", () => {
  it("a new account, no pool at all: rebuild now", () => {
    assert.equal(needsRecoRefill({ usable: 0, poolComputedAt: null, requestedAt: null, now }), true);
  });

  it("a pool used up minutes after it was built (¿Las viste?): rebuild, freshness does not hold it back", () => {
    assert.equal(needsRecoRefill({ usable: 0, poolComputedAt: ago(5 * 60 * 1000), requestedAt: null, now }), true);
  });

  it("a thin but fresh pool waits; a thin old one is rebuilt", () => {
    assert.equal(needsRecoRefill({ usable: 3, poolComputedAt: ago(RECO_REFILL_FRESH_MS - 1000), requestedAt: null, now }), false);
    assert.equal(needsRecoRefill({ usable: 3, poolComputedAt: ago(RECO_REFILL_FRESH_MS + 1000), requestedAt: null, now }), true);
  });

  it("enough left: nothing to do", () => {
    assert.equal(needsRecoRefill({ usable: RECO_REFILL_BELOW, poolComputedAt: null, requestedAt: null, now }), false);
  });

  it("asked a moment ago: no second rebuild, so one that finds nothing never loops", () => {
    const requestedAt = now.getTime() - RECO_REFILL_COOLDOWN_MS + 1000;
    assert.equal(needsRecoRefill({ usable: 0, poolComputedAt: null, requestedAt, now }), false);
    assert.equal(
      needsRecoRefill({ usable: 0, poolComputedAt: null, requestedAt: now.getTime() - RECO_REFILL_COOLDOWN_MS - 1000, now }),
      true,
    );
  });
});
