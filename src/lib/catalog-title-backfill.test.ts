import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  TITLE_BACKFILL_BATCH_SIZE,
  allowsTitleBackfill,
  rateLimitDelayMs,
  runCatalogTitleBackfill,
  type CatalogTitleRow,
} from "@/lib/catalog-title-backfill";
import { parseRetryAfterSeconds, TmdbRequestError } from "@/lib/tmdb";

const row = (id: string, name: string): CatalogTitleRow => ({
  id,
  tmdbId: Number(id),
  kind: "MOVIE",
  name,
  originalName: null,
  alternateNames: [],
});

describe("catalog title backfill (FIL-I48-1)", () => {
  it("dry-run resolves every row and never writes", async () => {
    const writes: string[] = [];
    const stats = await runCatalogTitleBackfill({
      rows: [row("1", "Intensamente"), row("2", "El origen")],
      batchSize: TITLE_BACKFILL_BATCH_SIZE,
      dryRun: true,
      pauseMs: 0,
      sleep: async () => {},
      resolve: async (film) => ({ name: `${film.name} MX`, originalName: film.name }),
      write: async (film) => {
        writes.push(film.id);
      },
    });

    assert.deepEqual(writes, []);
    assert.equal(stats.updated, 2);
    assert.equal(stats.unchanged, 0);
    assert.equal(stats.batches, 1);
  });

  it("walks the catalog in batches and pauses between rows", async () => {
    const pauses: number[] = [];
    const stats = await runCatalogTitleBackfill({
      rows: [row("1", "Uno"), row("2", "Dos"), row("3", "Tres")],
      batchSize: 2,
      dryRun: true,
      pauseMs: 25,
      sleep: async (ms) => {
        pauses.push(ms);
      },
      resolve: async (film) => ({ name: film.name }),
      write: async () => {
        throw new Error("dry-run");
      },
    });

    assert.equal(stats.batches, 2);
    assert.equal(stats.unchanged, 3);
    assert.deepEqual(pauses, [25, 25]);
  });

  it("waits for Retry-After on 429 and then writes once", async () => {
    const waits: number[] = [];
    let calls = 0;
    const writes: string[] = [];
    const stats = await runCatalogTitleBackfill({
      rows: [row("1", "Duna")],
      batchSize: 10,
      dryRun: false,
      pauseMs: 0,
      sleep: async (ms) => {
        waits.push(ms);
      },
      resolve: async () => {
        calls += 1;
        if (calls < 3) {
          throw new TmdbRequestError("rate_limit", "lento", 429, 2);
        }
        return { name: "Dune", originalName: "Dune", alternateNames: ["Duna"] };
      },
      write: async (film) => {
        writes.push(film.id);
      },
    });

    assert.deepEqual(waits, [2000, 2000]);
    assert.deepEqual(writes, ["1"]);
    assert.equal(stats.updated, 1);
    assert.equal(stats.failed, 0);
  });

  it("backs off when a 429 has no Retry-After, then stops the pass", async () => {
    const waits: number[] = [];
    await assert.rejects(
      () =>
        runCatalogTitleBackfill({
          rows: [row("1", "Duna"), row("2", "Otro")],
          batchSize: 10,
          dryRun: false,
          pauseMs: 0,
          sleep: async (ms) => {
            waits.push(ms);
          },
          resolve: async () => {
            throw new TmdbRequestError("rate_limit", "lento", 429, null);
          },
          write: async () => {
            throw new Error("no debía escribir");
          },
        }),
      (error: unknown) => error instanceof TmdbRequestError && error.code === "rate_limit",
    );
    assert.deepEqual(waits, [1000, 2000, 4000, 8000]);
    assert.equal(rateLimitDelayMs(0, null), 1000);
    assert.equal(rateLimitDelayMs(0, 2), 2000);
  });

  it("keeps going after a non-429 failure", async () => {
    const writes: string[] = [];
    const stats = await runCatalogTitleBackfill({
      rows: [row("1", "Rota"), row("2", "Sana")],
      batchSize: 10,
      dryRun: false,
      pauseMs: 0,
      sleep: async () => {},
      resolve: async (film) => {
        if (film.id === "1") {
          throw new TmdbRequestError("http", "TMDB respondió 404.", 404);
        }
        return { name: "Sana MX" };
      },
      write: async (film) => {
        writes.push(film.id);
      },
    });

    assert.deepEqual(writes, ["2"]);
    assert.equal(stats.failed, 1);
    assert.equal(stats.updated, 1);
  });

  it("refuses a remote database unless remote writes are explicitly allowed", () => {
    assert.equal(allowsTitleBackfill("postgresql://localhost:5432/filmia_test", false), true);
    assert.equal(allowsTitleBackfill("postgresql://127.0.0.1:5432/filmia_test", false), true);
    assert.equal(allowsTitleBackfill("postgresql://example.neon.tech/neondb", false), false);
    assert.equal(allowsTitleBackfill("postgresql://example.neon.tech/neondb", true), true);
    assert.equal(allowsTitleBackfill("not a url", false), false);
  });

  it("reads Retry-After as seconds or an HTTP date", () => {
    assert.equal(parseRetryAfterSeconds("3"), 3);
    assert.equal(parseRetryAfterSeconds("Wed, 21 Oct 2015 07:28:00 GMT", Date.parse("Wed, 21 Oct 2015 07:27:58 GMT")), 2);
    assert.equal(parseRetryAfterSeconds(null), null);
    assert.equal(parseRetryAfterSeconds("nope"), null);
  });

  it("ships an additive migration and does not rewrite the catalog", () => {
    const sql = readFileSync(new URL("../../drizzle/0027_catalog_alternate_names.sql", import.meta.url), "utf8");
    assert.match(sql, /ADD COLUMN IF NOT EXISTS "alternateNames" jsonb/);
    assert.doesNotMatch(sql, /\b(DROP|DELETE|TRUNCATE)\b/i);
  });
});
