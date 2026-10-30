import "@/lib/test-support/local-db";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { GET } from "./route";

// Only the guards: both answer before any TMDB, OMDb or database work starts.
describe("GET /api/cron/cine guards (FIL-I35-3)", () => {
  const previous = process.env.CRON_SECRET;
  before(() => {
    process.env.CRON_SECRET = "test-cron-secret";
  });
  after(() => {
    if (previous === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previous;
  });

  const call = (query: string, authorization?: string) =>
    GET(new Request(`http://localhost/api/cron/cine${query}`, { headers: authorization ? { authorization } : {} }));

  it("without a valid secret → 401, force or not", async () => {
    for (const [query, authorization] of [
      ["?force=2026", undefined],
      ["?force=2026", "Bearer wrong"],
      ["", "test-cron-secret"],
      ["?force=nope", undefined],
    ] as const) {
      const response = await call(query, authorization);
      assert.equal(response.status, 401, `${query} ${authorization}`);
      assert.deepEqual(await response.json(), { error: "unauthorized" });
    }
  });

  it("a force that is not a year → 400", async () => {
    for (const value of ["nope", "2999", "1899", ""]) {
      const response = await call(`?force=${value}`, "Bearer test-cron-secret");
      assert.equal(response.status, 400, value);
      assert.deepEqual(await response.json(), { error: "invalid_force" });
    }
  });
});
