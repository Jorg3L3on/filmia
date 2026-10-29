import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Platform } from "@/db";
import { PLATFORMS } from "@/lib/labels";
import {
  makeWatchlistCounter,
  missingRuntimeCount,
  optionQuery,
  platformFacet,
  toggleValue,
} from "@/lib/watchlist-facets";
import { filterRows, type WatchlistRow } from "@/lib/watchlist-filters";
import { EMPTY_WATCHLIST_QUERY, type WatchlistQuery } from "@/lib/watchlist-query";

const context = { now: Date.parse("2026-10-29T12:00:00Z") };

const row = (id: string, overrides: Partial<WatchlistRow> = {}): WatchlistRow => ({
  id,
  name: id,
  kind: "MOVIE",
  seriesStatus: null,
  flatrate: [],
  rentBuy: [],
  onMine: false,
  providersUnknown: false,
  runtime: 100,
  year: 2001,
  imdb: 7,
  votes: 2000,
  genres: [18],
  awarded: false,
  addedAt: context.now,
  arrivedAt: null,
  language: "en",
  snoozed: false,
  hasNote: false,
  people: [],
  ...overrides,
});

// Invented list: genres, platforms and runtimes spread so every facet has something to count.
const ROWS = Array.from({ length: 30 }, (_, index) =>
  row(`t${index}`, {
    kind: index % 4 === 0 ? "SERIES" : "MOVIE",
    flatrate: index % 3 === 0 ? (["NETFLIX"] as Platform[]) : index % 3 === 1 ? (["MAX"] as Platform[]) : [],
    onMine: index % 3 === 0,
    genres: index % 2 === 0 ? [18, 35] : [99],
    runtime: index % 5 === 0 ? null : 60 + index * 4,
    year: 1960 + index * 2,
    imdb: 5 + (index % 5),
    awarded: index % 7 === 0,
  }),
);

const QUERIES: WatchlistQuery[] = [
  EMPTY_WATCHLIST_QUERY,
  { ...EMPTY_WATCHLIST_QUERY, scope: "mine" },
  { ...EMPTY_WATCHLIST_QUERY, genres: [99], imdbMin: 7 },
  { ...EMPTY_WATCHLIST_QUERY, kind: "MOVIE", years: { min: 1980, max: 1999 }, short: true },
  { ...EMPTY_WATCHLIST_QUERY, platforms: ["MAX"], awarded: true },
];

describe("watchlist-facets/counts match the list", () => {
  const count = makeWatchlistCounter(ROWS, context);

  it("«Ver N» equals the filtered list for every query", () => {
    for (const query of QUERIES) {
      assert.equal(count(query), filterRows(ROWS, query, context).length);
    }
  });

  it("each option's count is the list you get by picking only it", () => {
    for (const query of QUERIES) {
      for (const genre of [18, 35, 99]) {
        const next = optionQuery(query, "genres", genre);
        assert.equal(count(next), filterRows(ROWS, { ...query, genres: [genre] }, context).length);
      }
    }
  });

  it("ignores the order when caching", () => {
    assert.equal(count({ ...EMPTY_WATCHLIST_QUERY, sort: "random", seed: 3 }), ROWS.length);
  });
});

describe("watchlist-facets/platforms", () => {
  const count = makeWatchlistCounter(ROWS, context);

  it("lists the viewer's platforms first, then the ones with titles", () => {
    const facet = platformFacet(EMPTY_WATCHLIST_QUERY, count, { userPlatforms: ["PRIME"], all: PLATFORMS });
    assert.equal(facet[0]?.platform, "PRIME");
    assert.equal(facet[0]?.mine, true);
    assert.equal(facet[0]?.count, 0);
    assert.deepEqual(facet.slice(1).map((entry) => entry.platform), ["NETFLIX", "MAX"]);
    assert.equal(facet[1]?.count, 10);
  });

  it("can list every platform («Ver las N»)", () => {
    const facet = platformFacet(EMPTY_WATCHLIST_QUERY, count, { userPlatforms: [], all: PLATFORMS, includeEmpty: true });
    assert.equal(facet.length, PLATFORMS.length);
  });
});

describe("watchlist-facets/helpers", () => {
  it("toggles a value", () => {
    assert.deepEqual(toggleValue([1, 2], 2), [1]);
    assert.deepEqual(toggleValue([1], 3), [1, 3]);
  });

  it("says how many titles have no runtime yet", () => {
    assert.equal(missingRuntimeCount(ROWS, EMPTY_WATCHLIST_QUERY, context), 6);
    assert.equal(missingRuntimeCount(ROWS, { ...EMPTY_WATCHLIST_QUERY, duration: { min: null, max: 90 } }, context), 6);
    assert.equal(missingRuntimeCount(ROWS, { ...EMPTY_WATCHLIST_QUERY, kind: "SERIES" }, context), 2);
  });
});
