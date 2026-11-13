import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { impliedRatingLabel, isVisteAnswer, VISTE_RATING } from "./core";

describe("quick answers without stars", () => {
  it("«me gustó» is liked for the engine, «no tanto» a negative", () => {
    assert.ok(VISTE_RATING.liked >= 7, "«me gustó» counts as liked");
    assert.ok(VISTE_RATING.meh < 7, "«no tanto» counts as a negative");
  });

  it("says it in words, never stars", () => {
    assert.equal(impliedRatingLabel(10), "Te encantó");
    assert.equal(impliedRatingLabel(VISTE_RATING.liked), "Te gustó");
    assert.equal(impliedRatingLabel(VISTE_RATING.meh), "No tanto");
    assert.equal(impliedRatingLabel(null), null);
  });

  it("knows its three answers", () => {
    assert.equal(isVisteAnswer("liked"), true);
    assert.equal(isVisteAnswer("loved"), false);
  });
});
