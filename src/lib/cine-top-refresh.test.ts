import "@/lib/test-support/local-db";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { planYearScores } from "./cine-top";
import { refreshYearTops, type ImdbRatings, type RefreshDeps, type YearRows } from "./cine-top-store";
import { ImdbRatingsUnavailable, readImdbRatingsOrNull } from "./imdb-ratings";

// 2026-10-29 in Mexico: this year and last are the recent ones.
const NOW = new Date("2026-10-29T16:00:00Z");
const DAY_MS = 24 * 60 * 60 * 1000;

const rowsOf = (year: number) =>
  ["a", "b", "c"].map((name) => ({
    id: `${year}-${name}`,
    tmdbId: year * 10 + name.charCodeAt(0),
    imdbId: name === "c" ? null : `tt${year}${name.charCodeAt(0)}`,
    imdbRating: null,
    imdbVotes: null,
  }));

/** Fake store: every year stored at 100 rows `daysAgo` ago, except those listed as missing. */
const fakeDeps = ({
  daysAgo = 10,
  missing = [] as number[],
  readRatings = async (_ids: ReadonlySet<string>): Promise<ImdbRatings | null> => new Map(),
} = {}) => {
  const calls = { load: [] as number[], read: [] as string[][], score: [] as { year: number; ratings: ImdbRatings | null }[] };
  const sizes = new Map<number, number>();
  for (let year = 2015; year <= 2026; year += 1) {
    if (!missing.includes(year)) sizes.set(year, 100);
  }
  const deps = {
    isOmdbConfigured: () => true,
    getYearTopSizes: async () => sizes,
    lastComputedAt: async (year: number) => (sizes.has(year) ? new Date(NOW.getTime() - daysAgo * DAY_MS) : null),
    loadYearRows: async (year: number) => {
      calls.load.push(year);
      return { ok: true, year, candidates: 3, rows: rowsOf(year) } as unknown as YearRows;
    },
    readRatings: async (ids: ReadonlySet<string>) => {
      calls.read.push([...ids].sort());
      return readRatings(ids);
    },
    scoreYearTop: async (loaded: YearRows, ratings: ImdbRatings | null) => {
      calls.score.push({ year: loaded.year, ratings });
      return { ok: true, year: loaded.year, candidates: 3, fromDataset: 0, omdbCalls: 0, ranked: 3 } as const;
    },
  } satisfies RefreshDeps;
  return { deps, calls };
};

describe("refreshYearTops (FIL-I35)", () => {
  it("reads IMDb's file once for every year the run computes", async () => {
    const { deps, calls } = fakeDeps({ missing: [2022, 2019, 2017] });
    const results = await refreshYearTops(NOW, { left: 500 }, deps);
    assert.deepEqual(calls.load, [2026, 2025, 2022, 2019]);
    assert.equal(calls.read.length, 1);
    assert.deepEqual(calls.read[0], [2026, 2025, 2022, 2019].flatMap((year) => [`tt${year}97`, `tt${year}98`]).sort());
    assert.deepEqual(calls.score.map((entry) => entry.year), [2026, 2025, 2022, 2019]);
    assert.deepEqual(results.at(-1), { ok: true, year: 2017, skipped: "later" });
  });

  it("keeps the 6.5-day freshness: a top 6 days old is skipped, one 7 days old recomputed", async () => {
    const fresh = fakeDeps({ daysAgo: 6 });
    const freshResults = await refreshYearTops(NOW, { left: 500 }, fresh.deps);
    assert.deepEqual(freshResults, [
      { ok: true, year: 2026, skipped: "fresh" },
      { ok: true, year: 2025, skipped: "fresh" },
    ]);
    assert.equal(fresh.calls.read.length, 0);

    const stale = fakeDeps({ daysAgo: 7 });
    await refreshYearTops(NOW, { left: 500 }, stale.deps);
    assert.deepEqual(stale.calls.load, [2026, 2025]);
    assert.equal(stale.calls.read.length, 1);
  });

  it("a file that cannot be read logs and the run goes on with OMDb alone", async () => {
    const logged: string[] = [];
    const { deps, calls } = fakeDeps({
      readRatings: (ids) =>
        readImdbRatingsOrNull(ids, {
          read: async () => {
            throw new ImdbRatingsUnavailable("status 503");
          },
          log: (message) => logged.push(message),
        }),
    });
    const results = await refreshYearTops(NOW, { left: 500 }, deps);
    assert.deepEqual(logged, ["imdb-ratings: unavailable status 503"]);
    assert.deepEqual(calls.score.map((entry) => entry.ratings), [null, null]);
    assert.ok(results.every((entry) => entry.ok));
    // With no file, each year's plan is today's: every candidate goes to OMDb.
    const plan = planYearScores(rowsOf(2026), null, 500, 100);
    assert.deepEqual(plan.ask.map((row) => row.id), ["2026-a", "2026-b", "2026-c"]);
  });

  it("an unexpected reader error is logged the same way", async () => {
    const logged: string[] = [];
    const ratings = await readImdbRatingsOrNull(new Set(["tt1"]), {
      read: async () => {
        throw new Error("boom");
      },
      log: (message) => logged.push(message),
    });
    assert.equal(ratings, null);
    assert.deepEqual(logged, ["imdb-ratings: unavailable boom"]);
  });
});
