import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CatalogRow, UserTitle } from "@/db";
import { catalogIdFor, flattenTitle } from "@/lib/catalog-core";

const personal = (overrides: Partial<UserTitle> = {}): UserTitle => ({
  id: "t1",
  userId: "u1",
  catalogId: "c1",
  rating: 9,
  review: "mine",
  platform: "NETFLIX",
  watchedAt: new Date("2026-10-01T12:00:00.000Z"),
  seriesStatus: null,
  seriesSeason: null,
  createdAt: new Date("2026-09-01T00:00:00.000Z"),
  updatedAt: new Date("2026-09-02T00:00:00.000Z"),
  ...overrides,
});

const shared: CatalogRow = {
  id: "c1",
  tmdbId: 603,
  kind: "MOVIE",
  name: "Matrix",
  originalName: "The Matrix",
  year: 1999,
  posterPath: "/fresh.jpg",
  backdropPath: "/bg.jpg",
  runtimeMinutes: 136,
  imdbId: "tt0133093",
  imdbRating: 8.7,
  imdbVotes: 2000000,
  awards: "Won 4 Oscars.",
  overview: "A hacker learns the truth.",
  tmdbGenres: [{ id: 28, name: "Acción" }],
  tmdbKeywords: [{ id: 1, name: "simulation" }],
  tmdbPeople: [],
  originalLanguage: "en",
  watchProvidersMx: null,
  watchProvidersFetchedAt: new Date("2026-10-05T00:00:00.000Z"),
  availableSince: null,
  posterAmbient: "10 20 30",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-10-05T00:00:00.000Z"),
};

describe("catalog-core/catalogIdFor", () => {
  it("matches migration 0009's md5(kind || ':' || tmdbId)", () => {
    // printf 'MOVIE:603' | md5  (Postgres: md5('MOVIE' || ':' || 603))
    assert.equal(catalogIdFor("MOVIE", 603), "ac02076384bd6e7096964877f20507fc");
    assert.notEqual(catalogIdFor("MOVIE", 603), catalogIdFor("SERIES", 603));
    assert.equal(catalogIdFor("MOVIE", 603), catalogIdFor("MOVIE", 603));
  });
});

describe("catalog-core/flattenTitle", () => {
  it("puts the film's data on the personal row and keeps personal fields", () => {
    const flat = flattenTitle({ ...personal(), catalog: shared });
    assert.equal(flat.name, "Matrix");
    assert.equal(flat.posterPath, "/fresh.jpg");
    assert.equal(flat.imdbRating, 8.7);
    assert.deepEqual(flat.tmdbKeywords, [{ id: 1, name: "simulation" }]);
    assert.equal(flat.rating, 9);
    assert.equal(flat.review, "mine");
    assert.equal(flat.platform, "NETFLIX");
    assert.equal(flat.watchedAt?.toISOString(), "2026-10-01T12:00:00.000Z");
  });

  it("keeps the Title's id and timestamps, not the catalog's", () => {
    const flat = flattenTitle({ ...personal(), catalog: shared });
    assert.equal(flat.id, "t1");
    assert.equal(flat.catalogId, "c1");
    assert.equal(flat.createdAt.toISOString(), "2026-09-01T00:00:00.000Z");
    assert.equal(flat.updatedAt.toISOString(), "2026-09-02T00:00:00.000Z");
    assert.equal("catalog" in flat, false);
  });

  it("preserves extra relations on the row", () => {
    const flat = flattenTitle({
      ...personal(),
      catalog: shared,
      listItems: [{ listId: "l1" }],
    });
    assert.deepEqual(flat.listItems, [{ listId: "l1" }]);
  });
});
