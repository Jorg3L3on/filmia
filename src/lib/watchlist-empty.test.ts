import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { heroEyebrow, sortedRankLabel, watchlistEmptyCopy, watchlistExits } from "./watchlist-empty";
import { makeWatchlistCounter } from "@/lib/watchlist-facets";
import type { WatchlistRow } from "@/lib/watchlist-filters";
import { EMPTY_WATCHLIST_QUERY, type WatchlistQuery } from "@/lib/watchlist-query";

const names = { genres: new Map([[99, "Documental"], [18, "Drama"]]), people: new Map<number, string>() };

describe("heroEyebrow", () => {
  it("keeps «Próxima en tu lista» in Mi orden", () => {
    assert.equal(heroEyebrow({ sort: null, dir: null }), "Próxima en tu lista");
    assert.equal(heroEyebrow({ sort: null, dir: null }, "Netflix"), "Próxima en tu lista");
  });

  it("says what the first row is under each order and direction", () => {
    assert.equal(heroEyebrow({ sort: "imdb", dir: null }), "Mejor nota de tu lista");
    assert.equal(heroEyebrow({ sort: "runtime", dir: null }), "La más corta");
    assert.equal(heroEyebrow({ sort: "runtime", dir: "desc" }), "La más larga");
    assert.equal(heroEyebrow({ sort: "year", dir: null }), "La más nueva");
    assert.equal(heroEyebrow({ sort: "year", dir: "asc" }), "La más antigua");
    assert.equal(heroEyebrow({ sort: "added", dir: null }), "La última en entrar");
    assert.equal(heroEyebrow({ sort: "arrived", dir: null }, "Prime Video"), "Acaba de llegar a Prime Video");
    assert.equal(heroEyebrow({ sort: "random", dir: null }), "Sorpréndeme: esta");
  });

  it("labels sorted rows by their place", () => {
    assert.equal(sortedRankLabel(3), "#3 en tu orden");
  });
});

const row = (id: string, overrides: Partial<WatchlistRow>): WatchlistRow => ({
  id,
  name: id,
  kind: "MOVIE",
  seriesStatus: null,
  flatrate: [],
  rentBuy: [],
  onMine: false,
  providersUnknown: false,
  runtime: 120,
  year: 2005,
  imdb: 7,
  votes: 2000,
  genres: [18],
  awarded: false,
  addedAt: 0,
  arrivedAt: null,
  language: "en",
  snoozed: false,
  hasNote: false,
  people: [],
  ...overrides,
});

// 12 documentaries from the 2000s, 5 dramas from the 1990s over 100 min, 1 short drama from 2010.
const ROWS = [
  ...Array.from({ length: 12 }, (_, index) => row(`doc${index}`, { genres: [99], year: 2004 })),
  ...Array.from({ length: 5 }, (_, index) => row(`drama${index}`, { year: 1995 })),
  row("corta", { runtime: 80, year: 2010 }),
];
const count = makeWatchlistCounter(ROWS, { now: 0 });
const MIX: WatchlistQuery = { ...EMPTY_WATCHLIST_QUERY, genres: [99], years: { min: 1990, max: 1999 }, short: true };

describe("watchlistExits", () => {
  it("leaves out exits that still show nothing; «Limpiar todo» stays", () => {
    assert.equal(count(MIX), 0);
    const exits = watchlistExits(MIX, count, names);
    assert.deepEqual(
      exits.map((exit) => [exit.label, exit.count, exit.best]),
      [["Limpiar todo", 18, false]],
    );
  });

  it("highlights the exit that brings the most back", () => {
    const query: WatchlistQuery = { ...EMPTY_WATCHLIST_QUERY, genres: [99], years: { min: 1990, max: 1999 } };
    const exits = watchlistExits(query, count, names);
    assert.equal(exits[0]?.label, "Quitar «1990s»");
    assert.equal(exits[0]?.count, 12);
    assert.equal(exits[0]?.best, true);
    assert.equal(exits[1]?.label, "Quitar «Documental»");
    assert.equal(exits[1]?.count, 5);
    assert.equal(exits[1]?.best, false);
    assert.equal(exits.at(-1)?.label, "Limpiar todo");
  });

  it("offers Todo when the scope empties the list", () => {
    const exits = watchlistExits({ ...EMPTY_WATCHLIST_QUERY, scope: "mine" }, count, names);
    assert.deepEqual(exits.map((exit) => [exit.key, exit.count]), [["scope", 18]]);
  });
});

describe("watchlistEmptyCopy", () => {
  it("names a single filter", () => {
    const copy = watchlistEmptyCopy({ ...EMPTY_WATCHLIST_QUERY, genres: [99] }, 262, names);
    assert.deepEqual(copy, { title: "Nada con «Documental»", description: "Ninguna de tus 262 cumple con «Documental»." });
  });

  it("says «esa mezcla» for several", () => {
    const copy = watchlistEmptyCopy(MIX, 262, names);
    assert.equal(copy.title, "Nada con esa mezcla");
    assert.equal(copy.description, "Ninguna de tus 262 cumple las tres cosas a la vez. Quita una y mira cuántas aparecen.");
  });

  it("explains Mis plataformas alone", () => {
    assert.equal(watchlistEmptyCopy({ ...EMPTY_WATCHLIST_QUERY, scope: "mine" }, 9, names).title, "Nada en tus plataformas");
  });
});
