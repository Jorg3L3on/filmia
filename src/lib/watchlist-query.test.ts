import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  activeFilterCount,
  clearFilters,
  effectiveDirection,
  EMPTY_WATCHLIST_QUERY,
  parseRange,
  parseWatchlistQuery,
  watchlistHref,
  withoutFilter,
  type WatchlistQuery,
} from "@/lib/watchlist-query";

const params = (search: string) => {
  const url = new URLSearchParams(search);
  const raw: Record<string, string[]> = {};
  for (const key of new Set(url.keys())) raw[key] = url.getAll(key);
  return raw;
};

const parse = (search: string) => parseWatchlistQuery(params(search));

describe("watchlist-query/«Esta noche» is gone (FIL-I34-1)", () => {
  it("ignores an old ?tonight=1 and shows Todo, without error", () => {
    assert.deepEqual(parse("tonight=1"), EMPTY_WATCHLIST_QUERY);
    assert.equal(watchlistHref("/watchlist", parse("tonight=1")), "/watchlist");
  });

  it("drops ?tonight while keeping the rest of an old link", () => {
    const query = parse("tonight=1&short=1&genre=18");
    assert.equal(query.short, true);
    assert.deepEqual(query.genres, [18]);
    assert.equal(watchlistHref("/watchlist", query), "/watchlist?short=1&genre=18");
  });
});

describe("watchlist-query/parse", () => {
  it("keeps old links: minePlatforms is the scope, year is Estreno", () => {
    const query = parse("minePlatforms=1&sort=year&awarded=1&genre=18,878");
    assert.equal(query.scope, "mine");
    assert.equal(query.sort, "year");
    assert.equal(effectiveDirection(query), "desc");
    assert.equal(query.awarded, true);
    assert.deepEqual(query.genres, [18, 878]);
  });

  it("parses every sheet param", () => {
    const query = parse(
      "kind=SERIES&seriesStatus=WATCHING&platform=NETFLIX&platform=MAX&access=rent&dur=100-150&year=1990-1999&imdb=7&votes=1&added=month&lang=JA&lang=fr&nosnooze=1&note=1&person=525&person=525",
    );
    assert.equal(query.kind, "SERIES");
    assert.equal(query.seriesStatus, "WATCHING");
    assert.deepEqual(query.platforms, ["NETFLIX", "MAX"]);
    assert.equal(query.access, "rent");
    assert.deepEqual(query.duration, { min: 100, max: 150 });
    assert.deepEqual(query.years, { min: 1990, max: 1999 });
    assert.equal(query.imdbMin, 7);
    assert.equal(query.votesFloor, true);
    assert.equal(query.added, "month");
    assert.deepEqual(query.languages, ["ja", "fr"]);
    assert.equal(query.hideSnoozed, true);
    assert.equal(query.withNote, true);
    assert.deepEqual(query.people, [525]);
  });

  it("rejects junk values", () => {
    const query = parse("sort=recent&imdb=9&added=ayer&lang=español&dur=abc&year=-&dir=sideways");
    assert.deepEqual(query, EMPTY_WATCHLIST_QUERY);
  });

  it("reads open and swapped ranges", () => {
    assert.deepEqual(parseRange("-99"), { min: null, max: 99 });
    assert.deepEqual(parseRange("150-"), { min: 150, max: null });
    assert.deepEqual(parseRange("2000-1990"), { min: 1990, max: 2000 });
    assert.equal(parseRange("-"), null);
  });

  it("keeps a direction only when it differs from the default, and the seed only for Aleatoria", () => {
    assert.equal(parse("sort=runtime&dir=asc").dir, null);
    assert.equal(parse("sort=runtime&dir=desc").dir, "desc");
    assert.equal(parse("sort=available&dir=asc").dir, null);
    assert.equal(parse("sort=random&seed=42").seed, 42);
    assert.equal(parse("sort=imdb&seed=42").seed, null);
  });
});

describe("watchlist-query/href", () => {
  it("round-trips through the URL", () => {
    const query: WatchlistQuery = {
      ...EMPTY_WATCHLIST_QUERY,
      scope: "mine",
      sort: "runtime",
      dir: "desc",
      kind: "MOVIE",
      platforms: ["MAX", "NETFLIX"],
      duration: { min: null, max: 100 },
      years: { min: 1980, max: null },
      imdbMin: 8,
      genres: [18],
      languages: ["ja"],
      people: [1, 2],
    };
    const href = watchlistHref("/watchlist", query);
    assert.equal(
      href,
      "/watchlist?minePlatforms=1&sort=runtime&dir=desc&kind=MOVIE&platform=NETFLIX&platform=MAX&dur=-100&year=1980-&imdb=8&genre=18&lang=ja&person=1&person=2",
    );
    assert.deepEqual(parse(href.split("?")[1] ?? ""), { ...query, platforms: ["NETFLIX", "MAX"] });
  });

  it("is the bare path with nothing set", () => {
    assert.equal(watchlistHref("/watchlist", EMPTY_WATCHLIST_QUERY), "/watchlist");
  });
});

describe("watchlist-query/filters", () => {
  it("counts filters, not the scope or the order", () => {
    const query = { ...EMPTY_WATCHLIST_QUERY, scope: "mine" as const, sort: "imdb" as const, short: true, genres: [18, 35], years: { min: 1990, max: 1999 } };
    assert.equal(activeFilterCount(query), 3);
  });

  it("removes one filter at a time; Tipo takes series status with it", () => {
    const query = { ...EMPTY_WATCHLIST_QUERY, kind: "SERIES" as const, seriesStatus: "WATCHING" as const, imdbMin: 7, votesFloor: true };
    assert.deepEqual(withoutFilter(query, "kind"), { ...query, kind: "ALL", seriesStatus: null });
    assert.deepEqual(withoutFilter(query, "imdb"), { ...query, imdbMin: null, votesFloor: false });
  });

  it("«Limpiar filtros» goes back to Todo and keeps the order", () => {
    const query = { ...EMPTY_WATCHLIST_QUERY, scope: "mine" as const, sort: "random" as const, seed: 7, short: true };
    assert.deepEqual(clearFilters(query), { ...EMPTY_WATCHLIST_QUERY, sort: "random", seed: 7 });
  });
});
