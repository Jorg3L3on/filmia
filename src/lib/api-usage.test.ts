import "@/lib/test-support/local-db";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import { setApiUsageWriterForTests, utcDay, type ApiProvider } from "@/lib/api-usage";
import { fetchImdbScore, lookupOmdbScore } from "@/lib/omdb";
import { searchTmdb } from "@/lib/tmdb";

const flush = () => new Promise((resolve) => setImmediate(resolve));

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("API usage counter (FIL-I37-2)", () => {
  let calls: { provider: ApiProvider; day: string }[] = [];
  const env = { omdb: process.env.OMDB_API_KEY, tmdb: process.env.TMDB_API_KEY };

  beforeEach(() => {
    calls = [];
    setApiUsageWriterForTests(async (provider, day) => {
      calls.push({ provider, day });
    });
    process.env.OMDB_API_KEY = "test-omdb-key";
    process.env.TMDB_API_KEY = "test-tmdb-key";
  });

  afterEach(() => {
    mock.restoreAll();
    setApiUsageWriterForTests();
    process.env.OMDB_API_KEY = env.omdb;
    process.env.TMDB_API_KEY = env.tmdb;
  });

  it("tmdb.ts stays importable from client components: no server-only imports", () => {
    const source = readFileSync(new URL("./tmdb.ts", import.meta.url), "utf8");
    assert.doesNotMatch(source, /from "@\/lib\/(api-usage|after-response|last-active)"/);
    assert.doesNotMatch(source, /from "next\/server"/);
  });

  it("keys the day in UTC", () => {
    assert.equal(utcDay(new Date("2026-10-29T23:30:00-06:00")), "2026-10-30");
  });

  it("counts one OMDb call per network request, refused ones included", async () => {
    const fetchMock = mock.method(globalThis, "fetch", async () => json({ Response: "True", imdbRating: "7.1" }));
    await lookupOmdbScore("tt0000001");
    await lookupOmdbScore("tt0000002");
    fetchMock.mock.mockImplementation(async () => json({ Response: "False", Error: "Request limit reached!" }, 401));
    await assert.rejects(lookupOmdbScore("tt0000003"));
    await flush();
    assert.equal(fetchMock.mock.callCount(), 3);
    assert.deepEqual(
      calls.map((call) => call.provider),
      ["omdb", "omdb", "omdb"],
    );
  });

  it("counts nothing when no request goes out (no key, no id)", async () => {
    const fetchMock = mock.method(globalThis, "fetch", async () => json({}));
    await fetchImdbScore("");
    process.env.OMDB_API_KEY = "";
    await fetchImdbScore("tt0000001");
    await flush();
    assert.equal(fetchMock.mock.callCount(), 0);
    assert.equal(calls.length, 0);
  });

  it("counts nothing when the request never reached TMDB", async () => {
    mock.method(globalThis, "fetch", async () => {
      throw new TypeError("fetch failed");
    });
    await assert.rejects(searchTmdb("Duna", "MOVIE"));
    await flush();
    assert.equal(calls.length, 0);
  });

  it("counts one TMDB call per network request", async () => {
    const fetchMock = mock.method(globalThis, "fetch", async () => json({ results: [] }));
    await searchTmdb("Duna", "MOVIE");
    await searchTmdb("Aftersun", "MOVIE");
    await flush();
    assert.equal(calls.filter((call) => call.provider === "tmdb").length, fetchMock.mock.callCount());
    assert.ok(fetchMock.mock.callCount() >= 2);
  });

  it("a failing counter never breaks the lookup", async () => {
    setApiUsageWriterForTests(async () => {
      throw new Error('relation "ApiUsage" does not exist');
    });
    mock.method(globalThis, "fetch", async () => json({ Response: "True", imdbRating: "8.0", imdbVotes: "1,234" }));
    const { score, answered } = await lookupOmdbScore("tt0000004");
    await flush();
    assert.equal(answered, true);
    assert.equal(score.rating, 8);
  });
});
