import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { toCoverflowTitle, type CoverflowSource } from "@/lib/coverflow-title";
import { deckAvailabilityPlatform } from "@/lib/streaming-platforms";

const backToTheFuture: CoverflowSource = {
  id: "t1",
  name: "Volver al futuro",
  kind: "MOVIE",
  year: 1985,
  rating: null,
  posterPath: null,
  platform: null,
  imdbRating: null,
  watchedAt: null,
  review: null,
  seriesStatus: null,
  tmdbGenres: [],
  // TMDB lists Prime Video first and HBO Max second (FIL-I41-3, D1).
  watchProvidersMx: {
    link: null,
    flatrate: [
      { providerId: 119, name: "Amazon Prime Video", logoPath: null, logoUrl: null },
      { providerId: 1899, name: "HBO Max", logoPath: null, logoUrl: null },
    ],
    rent: [],
    buy: [],
  },
};

describe("deck platform chip follows the user's platforms (FIL-I41-14)", () => {
  it("a Netflix + Max user sees Max, not the first TMDB provider", () => {
    const card = toCoverflowTitle(backToTheFuture, ["NETFLIX", "MAX"]);
    assert.equal(deckAvailabilityPlatform(card), "MAX");
  });

  it("a user without any of its platforms sees the first TMDB provider", () => {
    const card = toCoverflowTitle(backToTheFuture, ["NETFLIX"]);
    assert.equal(deckAvailabilityPlatform(card), "PRIME");
    assert.equal(deckAvailabilityPlatform(toCoverflowTitle(backToTheFuture)), "PRIME");
  });

  it("a Prime user still sees Prime", () => {
    assert.equal(deckAvailabilityPlatform(toCoverflowTitle(backToTheFuture, ["PRIME", "MAX"])), "PRIME");
  });
});
