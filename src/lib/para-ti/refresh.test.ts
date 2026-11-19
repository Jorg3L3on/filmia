import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { TmdbDiscoverOptions } from "@/lib/tmdb-discover-params";
import {
  DEFAULT_REFRESH_CAPS,
  mergeListed,
  poolKeyId,
  refreshParaTiPools,
  stalestFirst,
  type ListedCandidate,
  type PoolKey,
  type PoolRow,
  type RefreshDeps,
} from "./refresh";

const NOW = new Date("2026-11-17T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

const hit = (tmdbId: number, kind: "MOVIE" | "SERIES" = "MOVIE", extra: Partial<ListedCandidate> = {}): ListedCandidate => ({
  tmdbId,
  kind,
  name: `T${tmdbId}`,
  originalName: null,
  year: 2020,
  posterPath: `/p${tmdbId}.jpg`,
  voteAverage: 7,
  voteCount: 1000,
  ...extra,
});

/** Discover answers 20 distinct titles per page, ids unique per call. */
const fakeDeps = (overrides: Partial<RefreshDeps> & { known?: Set<number> } = {}) => {
  const written: Array<{ key: PoolKey; rows: readonly PoolRow[]; at: Date }> = [];
  let next = 1;
  const known = overrides.known ?? new Set<number>();
  const deps: RefreshDeps = {
    now: NOW,
    freshness: async () => new Map(),
    discover: async (options: TmdbDiscoverOptions) =>
      Array.from({ length: 20 }, () => hit(next++, options.kind ?? "MOVIE")),
    materialize: async (candidate, { allowCreate }) => {
      if (known.has(candidate.tmdbId)) return { catalogId: `c${candidate.tmdbId}`, created: false, tmdbCalls: 0 };
      if (!allowCreate) return null;
      return { catalogId: `c${candidate.tmdbId}`, created: true, tmdbCalls: 3 };
    },
    writePool: async (key, rows, at) => {
      written.push({ key, rows, at });
    },
    elapsedMs: () => 0,
    ...overrides,
  };
  return { deps, written };
};

describe("Para ti pool refresh (FIL-I60-2)", () => {
  it("orders pools stalest first: never filled, then oldest", () => {
    const freshness = new Map<string, number>();
    for (const key of stalestFirst(new Map())) freshness.set(poolKeyId(key), NOW.getTime() - DAY);
    freshness.set("miedo:SERIES", NOW.getTime() - 5 * DAY);
    freshness.delete("joya:MOVIE");
    const order = stalestFirst(freshness).map(poolKeyId);
    assert.equal(order.length, 16);
    assert.deepEqual(order.slice(0, 2), ["joya:MOVIE", "miedo:SERIES"]);
  });

  it("refreshes the stalest pool first and stops creating Catalog rows at the cap", async () => {
    const freshness = new Map<string, number>();
    for (const key of stalestFirst(new Map())) freshness.set(poolKeyId(key), NOW.getTime() - 2 * DAY);
    freshness.set("pensar:SERIES", NOW.getTime() - 9 * DAY);
    const { deps, written } = fakeDeps({ freshness: async () => freshness });
    const summary = await refreshParaTiPools(deps, { ...DEFAULT_REFRESH_CAPS, maxNewCatalog: 30, poolTarget: 20, maxPages: 1 });
    assert.equal(summary.order[0], "pensar:SERIES 20/20");
    assert.equal(summary.order[1], "reir:MOVIE 10/20 cut");
    assert.equal(written[0]?.key.antojo, "pensar");
    assert.equal(summary.newCatalogRows, 30);
    // 20 rows for the first pool, the 10 left for the next; after that nothing new can be created.
    assert.equal(written[0]?.rows.length, 20);
    assert.equal(written[1]?.rows.length, 10);
    // The full pool is fresh; the one the cap cut short stays stale for the next run.
    assert.equal(written[0]?.at.getTime(), NOW.getTime());
    assert.equal(written[1]?.at.getTime(), 0);
    assert.equal(written.length, 2);
    assert.equal(summary.deferred, 14);
    assert.equal(summary.failed, 0);
  });

  it("keeps known titles once the cap is reached", async () => {
    const known = new Set(Array.from({ length: 200 }, (_, index) => index + 1));
    const { deps, written } = fakeDeps({ known });
    const summary = await refreshParaTiPools(deps, { ...DEFAULT_REFRESH_CAPS, maxNewCatalog: 0, poolTarget: 20, maxPages: 1 });
    assert.equal(summary.newCatalogRows, 0);
    assert.ok(written.length > 0);
    assert.ok(written[0]!.rows.every((row) => row.catalogId.startsWith("c")));
  });

  it("leaves fresh pools alone and defers when the time budget is spent", async () => {
    const freshness = new Map<string, number>();
    for (const key of stalestFirst(new Map())) freshness.set(poolKeyId(key), NOW.getTime() - 60_000);
    freshness.set("reir:MOVIE", 0);
    const { deps } = fakeDeps({ freshness: async () => freshness, elapsedMs: () => 999_999 });
    const summary = await refreshParaTiPools(deps);
    assert.equal(summary.skippedFresh, 15);
    assert.equal(summary.deferred, 1);
    assert.equal(summary.refreshed, 0);
  });

  it("stops listing at the TMDB call cap", async () => {
    const { deps } = fakeDeps();
    const summary = await refreshParaTiPools(deps, { ...DEFAULT_REFRESH_CAPS, maxTmdbCalls: 10 });
    assert.ok(summary.tmdbCalls >= 10);
    assert.ok(summary.deferred > 0);
  });

  it("keeps the previous pool when every TMDB list fails", async () => {
    const { deps, written } = fakeDeps({
      discover: async () => {
        throw new Error("TMDB down");
      },
    });
    const summary = await refreshParaTiPools(deps, { ...DEFAULT_REFRESH_CAPS, maxPages: 1 });
    assert.equal(written.length, 0);
    assert.equal(summary.failed, 16);
  });

  it("merges pages without duplicates, posterless or thinly voted titles", () => {
    const merged = mergeListed(
      [
        [hit(1), hit(2, "MOVIE", { posterPath: null }), hit(3, "MOVIE", { voteCount: 10 })],
        [hit(1), hit(4), hit(5, "SERIES")],
      ],
      "MOVIE",
    );
    assert.deepEqual(merged.map((item) => item.tmdbId), [1, 4]);
  });
});
