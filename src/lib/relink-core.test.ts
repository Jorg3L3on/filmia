import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseRelinkPick, planRelink, relinkCandidates } from "@/lib/relink-core";

describe("relink-core/parseRelinkPick", () => {
  it("accepts a TMDB pick and normalizes optional fields", () => {
    assert.deepEqual(
      parseRelinkPick({ tmdbId: "603", kind: "MOVIE", name: " Matrix ", year: 1999, posterPath: "" }),
      { tmdbId: 603, kind: "MOVIE", name: "Matrix", originalName: null, year: 1999, posterPath: null },
    );
  });

  it("rejects bad ids, unknown kinds and missing names", () => {
    assert.equal(parseRelinkPick({ tmdbId: 0, kind: "MOVIE", name: "X" }), null);
    assert.equal(parseRelinkPick({ tmdbId: 1.5, kind: "MOVIE", name: "X" }), null);
    assert.equal(parseRelinkPick({ tmdbId: 603, kind: "PERSON", name: "X" }), null);
    assert.equal(parseRelinkPick({ tmdbId: 603, kind: "MOVIE", name: "  " }), null);
    assert.equal(parseRelinkPick(null), null);
  });
});

describe("relink-core/planRelink", () => {
  const base = { titleId: "t1", currentCatalogId: "c-old", targetCatalogId: "c-new" };

  it("is a no-op when the entry already points at the target", () => {
    assert.deepEqual(
      planRelink({ ...base, targetCatalogId: "c-old", ownedTitleIdForTarget: "t1" }),
      { kind: "same" },
    );
  });

  it("refuses when the user already has another entry for the target film", () => {
    assert.deepEqual(planRelink({ ...base, ownedTitleIdForTarget: "t2" }), {
      kind: "duplicate",
      titleId: "t2",
    });
  });

  it("relinks otherwise, including entries still without a catalog", () => {
    assert.deepEqual(planRelink({ ...base, ownedTitleIdForTarget: null }), { kind: "relink" });
    assert.deepEqual(
      planRelink({ ...base, currentCatalogId: null, ownedTitleIdForTarget: null }),
      { kind: "relink" },
    );
  });
});

describe("relink-core/relinkCandidates", () => {
  const results = [
    { tmdbId: 603, kind: "MOVIE" as const },
    { tmdbId: 604, kind: "MOVIE" as const },
    { tmdbId: 1100, kind: "SERIES" as const },
  ];

  it("keeps the same kind and drops the current match", () => {
    assert.deepEqual(
      relinkCandidates(results, { kind: "MOVIE", tmdbId: 603 }).map((result) => result.tmdbId),
      [604],
    );
    assert.deepEqual(
      relinkCandidates(results, { kind: "SERIES", tmdbId: null }).map((result) => result.tmdbId),
      [1100],
    );
  });
});
