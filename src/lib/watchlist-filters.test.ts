import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  filterRows,
  rowMatches,
  scopeCounts,
  shuffleWithSeed,
  sortPillLabel,
  sortRows,
  type WatchlistRow,
} from "@/lib/watchlist-filters";
import { EMPTY_WATCHLIST_QUERY, type WatchlistQuery } from "@/lib/watchlist-query";

const NOW = Date.parse("2026-10-29T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const context = { now: NOW };

/** Invented titles only. */
const row = (id: string, overrides: Partial<WatchlistRow> = {}): WatchlistRow => ({
  id,
  name: id,
  kind: "MOVIE",
  seriesStatus: null,
  flatrate: [],
  rentBuy: [],
  onMine: false,
  providersUnknown: false,
  runtime: 120,
  year: 2000,
  imdb: 7,
  votes: 5000,
  genres: [18],
  awarded: false,
  addedAt: NOW - 60 * DAY,
  arrivedAt: null,
  language: "en",
  snoozed: false,
  hasNote: false,
  people: [],
  ...overrides,
});

const ROWS: WatchlistRow[] = [
  row("Fuego lento", { year: 1999, runtime: 86, imdb: 7.5, flatrate: ["MAX"], onMine: true, addedAt: NOW - 2 * DAY, arrivedAt: NOW - 3 * DAY }),
  row("Los que se quedan", { year: 1998, runtime: 88, imdb: 8.2, flatrate: ["NETFLIX"], onMine: true, awarded: true, language: "es", hasNote: true }),
  row("Costa de nadie", { kind: "SERIES", seriesStatus: "WATCHING", year: 2023, runtime: 48, imdb: 8.4, votes: 400, rentBuy: ["PRIME"], genres: [9648], people: [77] }),
  row("Cielo de agosto", { year: 1994, runtime: 152, imdb: null, votes: null, genres: [18, 10749], snoozed: true, addedAt: NOW - 300 * DAY, arrivedAt: NOW - 30 * DAY }),
  row("Sin datos", { year: null, runtime: null, imdb: null, votes: null, genres: [], language: null }),
];

const q = (patch: Partial<WatchlistQuery>): WatchlistQuery => ({ ...EMPTY_WATCHLIST_QUERY, ...patch });
const ids = (rows: WatchlistRow[]) => rows.map((item) => item.id);
const names = (patch: Partial<WatchlistQuery>) => ids(filterRows(ROWS, q(patch), context));

describe("watchlist-filters/scope", () => {
  it("counts both cells over the whole list", () => {
    assert.deepEqual(scopeCounts(ROWS), { all: 5, mine: 2 });
    assert.deepEqual(scopeCounts([]), { all: 0, mine: 0 });
  });

  it("Mis plataformas keeps what is included on the viewer's platforms", () => {
    assert.deepEqual(names({ scope: "mine" }), ["Fuego lento", "Los que se quedan"]);
    assert.equal(names({ scope: "all" }).length, 5);
  });
});

describe("watchlist-filters/each filter", () => {
  it("Tipo and series status", () => {
    assert.deepEqual(names({ kind: "SERIES" }), ["Costa de nadie"]);
    assert.deepEqual(names({ seriesStatus: "WATCHING" }), ["Costa de nadie"]);
    assert.equal(names({ seriesStatus: "NONE" }).length, 0);
  });

  it("platforms: subscription vs rent or buy", () => {
    assert.deepEqual(names({ platforms: ["NETFLIX", "MAX"] }), ["Fuego lento", "Los que se quedan"]);
    assert.deepEqual(names({ platforms: ["PRIME"] }), []);
    assert.deepEqual(names({ platforms: ["PRIME"], access: "rent" }), ["Costa de nadie"]);
  });

  it("Cortas: movies under 100 min, never series", () => {
    assert.deepEqual(names({ short: true }), ["Fuego lento", "Los que se quedan"]);
  });

  it("duration and year ranges leave unknown values out", () => {
    assert.deepEqual(names({ duration: { min: 100, max: 150 } }), []);
    assert.deepEqual(names({ duration: { min: 150, max: null } }), ["Cielo de agosto"]);
    assert.deepEqual(names({ duration: { min: null, max: 60 } }), ["Costa de nadie"]);
    assert.deepEqual(names({ years: { min: 1990, max: 1999 } }), ["Fuego lento", "Los que se quedan", "Cielo de agosto"]);
    assert.deepEqual(names({ years: { min: null, max: 1997 } }), ["Cielo de agosto"]);
  });

  it("IMDb minimum and the 1 000 votes floor", () => {
    assert.deepEqual(names({ imdbMin: 8 }), ["Los que se quedan", "Costa de nadie"]);
    assert.deepEqual(names({ imdbMin: 8, votesFloor: true }), ["Los que se quedan"]);
  });

  it("genres OR inside, AND with the rest", () => {
    assert.deepEqual(names({ genres: [10749, 9648] }), ["Costa de nadie", "Cielo de agosto"]);
    assert.deepEqual(names({ genres: [18], short: true }), ["Fuego lento", "Los que se quedan"]);
  });

  it("awarded, added, language, «Ahora no», my note, director", () => {
    assert.deepEqual(names({ awarded: true }), ["Los que se quedan"]);
    assert.deepEqual(names({ added: "week" }), ["Fuego lento"]);
    assert.deepEqual(names({ added: "old" }), ["Cielo de agosto"]);
    assert.deepEqual(names({ languages: ["es"] }), ["Los que se quedan"]);
    assert.equal(names({ hideSnoozed: true }).includes("Cielo de agosto"), false);
    assert.deepEqual(names({ withNote: true }), ["Los que se quedan"]);
    assert.deepEqual(names({ people: [77] }), ["Costa de nadie"]);
  });

  it("`except` skips one filter (facets, exits)", () => {
    const query = q({ scope: "mine", kind: "SERIES" });
    assert.equal(rowMatches(ROWS[2] as WatchlistRow, query, context), false);
    assert.equal(rowMatches(ROWS[2] as WatchlistRow, query, context, "scope"), true);
    assert.equal(rowMatches(ROWS[0] as WatchlistRow, query, context, "kind"), true);
  });
});

describe("watchlist-filters/orders", () => {
  const sorted = (patch: Partial<WatchlistQuery>) => ids(sortRows(ROWS, q(patch)));

  it("Mi orden keeps the manual order", () => {
    assert.deepEqual(sorted({}), ids(ROWS));
  });

  it("Más cortas ↑ / Más largas ↓, unknown last both ways", () => {
    assert.deepEqual(sorted({ sort: "runtime" }), ["Costa de nadie", "Fuego lento", "Los que se quedan", "Cielo de agosto", "Sin datos"]);
    assert.deepEqual(sorted({ sort: "runtime", dir: "desc" }), ["Cielo de agosto", "Los que se quedan", "Fuego lento", "Costa de nadie", "Sin datos"]);
  });

  it("Estreno is newest first by default and flips", () => {
    assert.deepEqual(sorted({ sort: "year" }), ["Costa de nadie", "Fuego lento", "Los que se quedan", "Cielo de agosto", "Sin datos"]);
    assert.deepEqual(sorted({ sort: "year", dir: "asc" }).slice(0, 2), ["Cielo de agosto", "Los que se quedan"]);
  });

  it("Mejor valoradas puts 1 000+ votes first", () => {
    assert.deepEqual(sorted({ sort: "imdb" }), ["Los que se quedan", "Fuego lento", "Costa de nadie", "Cielo de agosto", "Sin datos"]);
    assert.deepEqual(sorted({ sort: "imdb", dir: "asc" }).slice(0, 2), ["Fuego lento", "Los que se quedan"]);
  });

  it("Agregadas hace poco and Acaba de llegar", () => {
    assert.equal(sorted({ sort: "added" })[0], "Fuego lento");
    assert.equal(sorted({ sort: "added", dir: "asc" })[0], "Cielo de agosto");
    assert.deepEqual(sorted({ sort: "arrived" }).slice(0, 2), ["Fuego lento", "Cielo de agosto"]);
  });

  it("Disponibles ahora: on my platforms first, manual order inside", () => {
    assert.deepEqual(sorted({ sort: "available" }), ["Fuego lento", "Los que se quedan", "Costa de nadie", "Cielo de agosto", "Sin datos"]);
  });

  it("Aleatoria is stable for a seed and reshuffles with another", () => {
    const first = sorted({ sort: "random", seed: 12345 });
    assert.deepEqual(sorted({ sort: "random", seed: 12345 }), first);
    assert.deepEqual([...first].sort(), [...ids(ROWS)].sort());
    const many = Array.from({ length: 40 }, (_, index) => `t${index}`);
    assert.notDeepEqual(shuffleWithSeed(many, 1), shuffleWithSeed(many, 2));
    assert.deepEqual(shuffleWithSeed(many, 9), shuffleWithSeed(many, 9));
  });

  it("names the pill by order and direction", () => {
    assert.equal(sortPillLabel({ sort: null, dir: null }), "Mi orden");
    assert.equal(sortPillLabel({ sort: "runtime", dir: null }), "Más cortas");
    assert.equal(sortPillLabel({ sort: "runtime", dir: "desc" }), "Más largas");
    assert.equal(sortPillLabel({ sort: "random", dir: null }), "Aleatoria");
  });
});
