import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createEnrichBudget,
  factsFromCatalog,
  pickEnrichmentCandidates,
  pickPlatformName,
  searchFactsKey,
  type SearchFactsRow,
} from "./search-result-facts";

const row = (overrides: Partial<SearchFactsRow> = {}): SearchFactsRow => ({
  tmdbId: 340666,
  kind: "MOVIE",
  imdbId: "tt4550098",
  imdbRating: 7.4,
  awards: "Nominated for 1 Oscar. 21 wins & 158 nominations total",
  runtimeMinutes: 116,
  tmdbGenres: [{ id: 18, name: "Drama" }, { id: 53, name: "Suspense" }],
  watchProvidersMx: {
    link: null,
    flatrate: [{ providerId: 8, name: "Netflix", logoPath: null, logoUrl: null }],
    rent: [],
    buy: [],
  },
  ...overrides,
});

describe("factsFromCatalog", () => {
  it("reads IMDb, the award chip, runtime, first genre and first subscription", () => {
    assert.deepEqual(factsFromCatalog(row()), {
      imdbRating: 7.4,
      awardLabel: "Nominada al Óscar",
      runtimeMinutes: 116,
      genre: "Drama",
      platform: "Netflix",
      pending: false,
    });
  });

  it("stays empty where the Catalog is", () => {
    const facts = factsFromCatalog(
      row({ imdbRating: null, awards: null, tmdbGenres: [], watchProvidersMx: null, runtimeMinutes: null }),
    );
    assert.equal(facts.imdbRating, null);
    assert.equal(facts.awardLabel, null);
    assert.equal(facts.genre, null);
    assert.equal(facts.platform, null);
  });
});

describe("pickEnrichmentCandidates", () => {
  const items = [
    { tmdbId: 1, kind: "MOVIE" as const },
    { tmdbId: 2, kind: "MOVIE" as const },
    { tmdbId: 2, kind: "MOVIE" as const },
    { tmdbId: 3, kind: "SERIES" as const },
    { tmdbId: 4, kind: "MOVIE" as const },
  ];

  it("takes unknown films and snapshots in order, once each, up to the limit", () => {
    const rows = new Map([
      [searchFactsKey("MOVIE", 1), row({ tmdbId: 1 })],
      [searchFactsKey("SERIES", 3), row({ tmdbId: 3, kind: "SERIES", imdbId: null, runtimeMinutes: null, tmdbGenres: [] })],
    ]);
    assert.deepEqual(pickEnrichmentCandidates(items, rows), [
      { tmdbId: 2, kind: "MOVIE" },
      { tmdbId: 3, kind: "SERIES" },
      { tmdbId: 4, kind: "MOVIE" },
    ]);
    assert.deepEqual(pickEnrichmentCandidates(items, rows, 2), [
      { tmdbId: 2, kind: "MOVIE" },
      { tmdbId: 3, kind: "SERIES" },
    ]);
  });

  it("does not retry a film OMDb has no rating for yet", () => {
    const rows = new Map([[searchFactsKey("MOVIE", 1), row({ tmdbId: 1, imdbRating: null })]]);
    assert.deepEqual(pickEnrichmentCandidates([{ tmdbId: 1, kind: "MOVIE" }], rows), []);
  });
});

describe("createEnrichBudget", () => {
  it("grants up to the window's budget per user and refills after it", () => {
    const take = createEnrichBudget(10, 60_000);
    assert.equal(take("a", 6, 0), 6);
    assert.equal(take("a", 6, 1_000), 4);
    assert.equal(take("a", 6, 2_000), 0);
    assert.equal(take("b", 6, 2_000), 6);
    assert.equal(take("a", 6, 61_500), 6);
  });
});

describe("pickPlatformName", () => {
  const offers = (...names: string[]) => ({
    link: null,
    flatrate: names.map((name, index) => ({ providerId: index, name, logoPath: null, logoUrl: null })),
    rent: [],
    buy: [],
  });

  it("prefers a service over an Amazon Channel add-on", () => {
    assert.equal(pickPlatformName(offers("Howdy Amazon Channel", "Prime Video")), "Prime Video");
  });

  it("names the add-on without the suffix when it is the only one", () => {
    assert.equal(pickPlatformName(offers("MUBI Amazon Channel")), "MUBI");
  });

  it("is null without subscriptions", () => {
    assert.equal(pickPlatformName(offers()), null);
    assert.equal(pickPlatformName(null), null);
  });
});
