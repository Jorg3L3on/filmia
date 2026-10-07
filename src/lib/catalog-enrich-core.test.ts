import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { catalogEnrichmentPatch, onlyMissingFields } from "@/lib/catalog-enrich-core";
import type { TitleMetadata } from "@/lib/metadata";

const full: TitleMetadata = {
  tmdbId: 389,
  name: "12 Hombres en Pugna",
  originalName: "12 Angry Men",
  year: 1957,
  posterPath: "/poster.jpg",
  backdropPath: "/back.jpg",
  runtimeMinutes: 97,
  imdbId: "tt0050083",
  imdbRating: 9,
  imdbVotes: 900000,
  awards: "Nominated for 3 Oscars.",
  overview: "Un jurado…",
  tmdbGenres: [{ id: 18, name: "Drama" }],
  tmdbKeywords: [{ id: 1, name: "jury" }],
  tmdbPeople: [{ id: 2, name: "Sidney Lumet", role: "director" }],
  originalLanguage: "en",
};

describe("catalog-enrich-core/catalogEnrichmentPatch", () => {
  it("writes everything a complete lookup returned", () => {
    const patch = catalogEnrichmentPatch(full, { posterAmbient: "10 20 30" });
    assert.equal(patch.imdbRating, 9);
    assert.equal(patch.awards, "Nominated for 3 Oscars.");
    assert.equal(patch.posterAmbient, "10 20 30");
    assert.deepEqual(patch.tmdbGenres, [{ id: 18, name: "Drama" }]);
  });

  it("never blanks OMDb data when OMDb returned nothing (dead key, rate limit)", () => {
    const patch = catalogEnrichmentPatch({ ...full, imdbRating: null, imdbVotes: null, awards: null });
    assert.equal("imdbRating" in patch, false);
    assert.equal("imdbVotes" in patch, false);
    assert.equal("awards" in patch, false);
    assert.equal(patch.imdbId, "tt0050083");
  });

  it("drops empty strings, zeros and empty lists instead of writing them", () => {
    const patch = catalogEnrichmentPatch({
      ...full,
      overview: "  ",
      runtimeMinutes: 0,
      tmdbKeywords: [],
      posterPath: null,
      name: "",
    });
    for (const key of ["overview", "runtimeMinutes", "tmdbKeywords", "posterPath", "name", "posterAmbient"]) {
      assert.equal(key in patch, false, `${key} should be left alone`);
    }
  });
});

describe("catalog-enrich-core/onlyMissingFields", () => {
  it("fills empty columns and leaves stored ones alone", () => {
    const patch = catalogEnrichmentPatch(full);
    const kept = onlyMissingFields(patch, {
      name: "Doce hombres en pugna",
      posterPath: "https://upload.wikimedia.org/poster.jpg",
      imdbRating: 8.9,
      imdbId: null,
      overview: "",
      tmdbKeywords: [],
    });
    assert.equal("name" in kept, false);
    assert.equal("posterPath" in kept, false);
    assert.equal("imdbRating" in kept, false);
    assert.equal(kept.imdbId, "tt0050083");
    assert.equal(kept.overview, "Un jurado…");
    assert.deepEqual(kept.tmdbKeywords, [{ id: 1, name: "jury" }]);
  });
});
