import "@/lib/test-support/local-db";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { GET } from "./route";

// Only the guard: it answers before any database or TMDB work starts.
describe("GET /api/cron/para-ti guard (FIL-I60-2)", () => {
  const previous = process.env.CRON_SECRET;
  before(() => {
    process.env.CRON_SECRET = "test-cron-secret";
  });
  after(() => {
    if (previous === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previous;
  });

  it("without the same secret as the other crons → 401", async () => {
    for (const authorization of [undefined, "Bearer wrong", "test-cron-secret"]) {
      const response = await GET(
        new Request("http://localhost/api/cron/para-ti", { headers: authorization ? { authorization } : {} }),
      );
      assert.equal(response.status, 401, String(authorization));
      assert.deepEqual(await response.json(), { error: "unauthorized" });
    }
  });
});
