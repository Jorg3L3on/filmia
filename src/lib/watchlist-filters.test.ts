import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { catalogHref } from "@/lib/catalog-href";
import {
  applyWatchlistFilters,
  genresInList,
  parseFlag,
  parseGenreIds,
  parseWatchlistSort,
  sortWatchlistItems,
  type WatchlistFilterItem,
} from "@/lib/watchlist-filters";

const DRAMA = { id: 18, name: "Drama" };
const SCIFI = { id: 878, name: "Ciencia ficción" };
const DOC = { id: 99, name: "Documental" };

const item = (
  id: string,
  overrides: Partial<WatchlistFilterItem["title"]> = {},
  addedAt = "2026-09-01T00:00:00Z",
): WatchlistFilterItem => ({
  addedAt,
  title: {
    id,
    name: id,
    kind: "MOVIE",
    year: 2000,
    runtimeMinutes: 120,
    imdbRating: 7,
    availableSince: null,
    awards: null,
    tmdbGenres: [DRAMA],
    ...overrides,
  },
});

const ITEMS = [
  item("blade", { name: "Blade Runner", year: 1982, runtimeMinutes: 117, imdbRating: 8.1, availableSince: "2026-10-05T00:00:00Z", awards: "Nominated for 2 Oscars. 13 wins & 21 nominations total", tmdbGenres: [SCIFI, DRAMA] }, "2026-09-01T00:00:00Z"),
  item("petite", { name: "Petite Maman", year: 2021, runtimeMinutes: 72, imdbRating: 7.3, tmdbGenres: [DRAMA] }, "2026-09-03T00:00:00Z"),
  item("chimp", { name: "El imperio de los chimpancés", kind: "SERIES", year: 2023, runtimeMinutes: 45, imdbRating: 8.2, availableSince: "2026-10-01T00:00:00Z", tmdbGenres: [DOC] }, "2026-09-02T00:00:00Z"),
  item("sinnada", { name: "Sin datos", year: null, runtimeMinutes: null, imdbRating: null, tmdbGenres: [] }, "2026-08-01T00:00:00Z"),
];

describe("watchlist-filters/parse", () => {
  it("parses the sort, flags and genre ids", () => {
    assert.equal(parseWatchlistSort("imdb"), "imdb");
    assert.equal(parseWatchlistSort(["year", "runtime"]), "runtime");
    assert.equal(parseWatchlistSort("recent"), null);
    assert.equal(parseFlag("1"), true);
    assert.equal(parseFlag("0"), false);
    assert.deepEqual(parseGenreIds(["18", "878,18", "x"]), [18, 878]);
    assert.deepEqual(parseGenreIds(undefined), []);
  });

  it("serialises the rail params after the shared ones", () => {
    assert.equal(
      catalogHref("/watchlist", { tonight: true, genres: [18, 878], sort: "imdb" }),
      "/watchlist?sort=imdb&tonight=1&genre=18&genre=878",
    );
    assert.equal(catalogHref("/watchlist", { short: true, awarded: true }), "/watchlist?short=1&awarded=1");
    assert.equal(catalogHref("/watchlist", { minePlatforms: true, platforms: ["NETFLIX"] }), "/watchlist?minePlatforms=1&platform=NETFLIX");
  });
});

describe("watchlist-filters/apply", () => {
  it("Cortas keeps movies under 100 min only", () => {
    assert.deepEqual(applyWatchlistFilters(ITEMS, { short: true }).map((i) => i.title.id), ["petite"]);
  });

  it("Premiadas keeps titles with an awards chip", () => {
    assert.deepEqual(applyWatchlistFilters(ITEMS, { awarded: true }).map((i) => i.title.id), ["blade"]);
  });

  it("Género is an OR across the chosen ids", () => {
    assert.deepEqual(applyWatchlistFilters(ITEMS, { genreIds: [878, 99] }).map((i) => i.title.id), ["blade", "chimp"]);
  });

  it("counts the genres present in the list", () => {
    assert.deepEqual(genresInList(ITEMS), [
      { id: 18, name: "Drama", count: 2 },
      { id: 878, name: "Ciencia ficción", count: 1 },
      { id: 99, name: "Documental", count: 1 },
    ]);
  });
});

describe("watchlist-filters/sort", () => {
  const ids = (sort: Parameters<typeof sortWatchlistItems>[1]) =>
    sortWatchlistItems(ITEMS, sort).map((i) => i.title.id);

  it("keeps the manual order when there is no sort", () => {
    assert.deepEqual(ids(null), ["blade", "petite", "chimp", "sinnada"]);
  });

  it("sorts with nulls last", () => {
    assert.deepEqual(ids("imdb"), ["chimp", "blade", "petite", "sinnada"]);
    assert.deepEqual(ids("runtime"), ["chimp", "petite", "blade", "sinnada"]);
    assert.deepEqual(ids("year"), ["blade", "petite", "chimp", "sinnada"]);
    assert.deepEqual(ids("arrived"), ["blade", "chimp", "petite", "sinnada"]);
    assert.deepEqual(ids("added"), ["petite", "chimp", "blade", "sinnada"]);
  });
});
