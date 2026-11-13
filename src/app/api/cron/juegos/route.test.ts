import "@/lib/test-support/local-db";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { GET } from "./route";

// Only the guard: it answers before any database work starts.
describe("GET /api/cron/juegos guard (FIL-I50-5)", () => {
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
        new Request("http://localhost/api/cron/juegos", { headers: authorization ? { authorization } : {} }),
      );
      assert.equal(response.status, 401, String(authorization));
      assert.deepEqual(await response.json(), { error: "unauthorized" });
    }
  });
});
