import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { excerpt, reviewShareText, starFills } from "./share-card";

describe("starFills", () => {
  it("maps 0–10 to five half-star slots", () => {
    assert.deepEqual(starFills(9), [1, 1, 1, 1, 0.5]);
    assert.deepEqual(starFills(10), [1, 1, 1, 1, 1]);
    assert.deepEqual(starFills(1), [0.5, 0, 0, 0, 0]);
    assert.deepEqual(starFills(null), []);
  });
});

describe("excerpt", () => {
  it("keeps short text and cuts long text at a word", () => {
    assert.equal(excerpt("  Una  joya. ", 40), "Una joya.");
    assert.equal(excerpt("La mejor película del año, sin duda alguna.", 30), "La mejor película del año…");
    assert.equal(excerpt(null, 10), "");
  });
});

describe("reviewShareText", () => {
  it("name, stars and the review", () => {
    assert.equal(reviewShareText("Athena", 8, " Tensión  urbana. "), "Athena · ★ 4.0 — «Tensión urbana.»");
    assert.equal(reviewShareText("Athena", null, null), "Athena");
  });
});
