import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { EMPTY_WATCHLIST_QUERY, parseWatchlistQuery, watchlistHref } from "@/lib/watchlist-query";
import {
  activeView,
  cleanViewName,
  isSavableQuery,
  matchesView,
  normalizeViewQuery,
  openView,
  parseViewQuery,
  scopeOnly,
  viewQueryString,
  viewSummary,
} from "@/lib/watchlist-views";

const names = { genres: new Map([[18, "Drama"]]), people: new Map<number, string>() };
const clasicos = { ...EMPTY_WATCHLIST_QUERY, years: { min: null, max: 1989 }, sort: "year" as const, dir: "asc" as const };
const VIEW_ID = "ck1clasicos0000000000000";

describe("watchlist-views/query string", () => {
  it("stores the canonical query without seed or view id", () => {
    assert.equal(viewQueryString(clasicos), "sort=year&dir=asc&year=-1989");
    assert.equal(viewQueryString({ ...clasicos, view: VIEW_ID }), "sort=year&dir=asc&year=-1989");
    assert.equal(viewQueryString({ ...EMPTY_WATCHLIST_QUERY, sort: "random", seed: 42 }), "sort=random");
    assert.equal(viewQueryString(parseViewQuery("sort=year&dir=asc&year=-1989")), "sort=year&dir=asc&year=-1989");
  });

  it("normalizes whatever the client sends", () => {
    assert.equal(normalizeViewQuery("year=-1989&sort=year&dir=asc&bogus=1&view=ck1other00000000000000"), "sort=year&dir=asc&year=-1989");
    assert.equal(normalizeViewQuery("tonight=1"), "");
    assert.equal(normalizeViewQuery("dir=desc&sort=year"), "sort=year", "default direction is dropped");
  });

  it("only scope, filters or an order are worth saving", () => {
    assert.equal(isSavableQuery(EMPTY_WATCHLIST_QUERY), false);
    assert.equal(isSavableQuery({ ...EMPTY_WATCHLIST_QUERY, scope: "mine" }), true);
    assert.equal(isSavableQuery({ ...EMPTY_WATCHLIST_QUERY, sort: "runtime" }), true);
  });
});

describe("watchlist-views/names", () => {
  it("trims, single-spaces and caps at 40", () => {
    assert.equal(cleanViewName("  Cortas   en  Netflix "), "Cortas en Netflix");
    assert.equal(cleanViewName("   "), null);
    assert.equal(cleanViewName("x".repeat(60))?.length, 40);
  });
});

describe("watchlist-views/open and match", () => {
  const view = { id: VIEW_ID, name: "Clásicos", query: viewQueryString(clasicos), pinned: true };

  it("opening a view tags the URL with it and matches until something changes", () => {
    const opened = openView(view);
    assert.equal(opened.view, VIEW_ID);
    assert.equal(watchlistHref("/watchlist", opened), `/watchlist?sort=year&dir=asc&year=-1989&view=${VIEW_ID}`);
    assert.equal(matchesView(opened, view), true);
    assert.equal(matchesView({ ...opened, imdbMin: 7 }, view), false);
    assert.equal(activeView(opened, [view])?.name, "Clásicos");
    assert.equal(activeView({ ...opened, view: null }, [view]), null);
  });

  it("the view id survives a round trip through the URL; junk ids are dropped", () => {
    assert.equal(parseWatchlistQuery({ view: VIEW_ID }).view, VIEW_ID);
    assert.equal(parseWatchlistQuery({ view: "../etc" }).view, null);
  });

  it("leaving a view from the scope bar keeps only the scope", () => {
    assert.deepEqual(scopeOnly("mine"), { ...EMPTY_WATCHLIST_QUERY, scope: "mine" });
  });
});

describe("watchlist-views/summary", () => {
  it("reads scope, filters, then the order with its arrow", () => {
    assert.equal(viewSummary(clasicos, names), "Antes de 1990 · Estreno ↑");
    assert.equal(viewSummary({ ...EMPTY_WATCHLIST_QUERY, scope: "mine", short: true }, names), "Mis plataformas · Cortas");
    assert.equal(viewSummary({ ...EMPTY_WATCHLIST_QUERY, kind: "SERIES", seriesStatus: "WATCHING" }, names), "Series · Series: viendo");
    assert.equal(viewSummary(EMPTY_WATCHLIST_QUERY, names), "Toda la lista");
  });
});
