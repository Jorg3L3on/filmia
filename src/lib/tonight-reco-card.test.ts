import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CoverflowTitle } from "../components/coverflow/types";
import { pickRefOf, recoResultOf } from "./tonight/reco-card";

const card = (overrides: Partial<CoverflowTitle> = {}): CoverflowTitle => ({
  id: "cat-1",
  name: "Sueño de fuga",
  kind: "MOVIE",
  year: 1994,
  rating: null,
  posterPath: "/poster.jpg",
  platform: null,
  imdbRating: 9.3,
  ...overrides,
});

const tonight = (source: "queue" | "reco") =>
  ({
    runtimeMinutes: 142,
    reasons: [],
    headline: [],
    fit: { fit: 1, endsAt: "", overflowMinutes: 0, remainingMinutes: 200 },
    wildcard: false,
    pinned: false,
    queueNote: null,
    lens: "para-ti",
    posterAmbient: null,
    source,
    reco:
      source === "reco"
        ? {
            tmdbId: 278,
            seedName: "Parasite",
            sourceKind: "recommendations" as const,
            originalName: "The Shawshank Redemption",
            backdropPath: "/back.jpg",
            overview: "Dos presos.",
          }
        : undefined,
  }) satisfies CoverflowTitle["tonight"];

describe("tonight/reco-card", () => {
  it("addresses a recommendation by film and a queue card by title", () => {
    assert.deepEqual(pickRefOf(card({ tonight: tonight("reco") })), { catalogId: "cat-1" });
    assert.deepEqual(pickRefOf(card({ id: "t-9", tonight: tonight("queue") })), { titleId: "t-9" });
    assert.deepEqual(pickRefOf(card({ id: "t-9" })), { titleId: "t-9" });
  });

  it("reads a recommended card as a TMDB result for the preview sheet", () => {
    assert.deepEqual(recoResultOf(card({ tonight: tonight("reco") })), {
      tmdbId: 278,
      kind: "MOVIE",
      name: "Sueño de fuga",
      originalName: "The Shawshank Redemption",
      year: 1994,
      posterPath: "/poster.jpg",
      backdropPath: "/back.jpg",
      overview: "Dos presos.",
    });
  });

  it("has no preview for a queue card", () => {
    assert.equal(recoResultOf(card({ tonight: tonight("queue") })), null);
    assert.equal(recoResultOf(card()), null);
  });
});
