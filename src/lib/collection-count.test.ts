import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { collectionCountLabel } from "@/lib/labels";

describe("collectionCountLabel (UX-05)", () => {
  it("says títulos when films and series mix or the kinds are unknown", () => {
    assert.equal(collectionCountLabel(26, 7), "26 títulos");
    assert.equal(collectionCountLabel(12), "12 títulos");
    assert.equal(collectionCountLabel(1), "1 título");
    assert.equal(collectionCountLabel(0, 0), "0 títulos");
  });
  it("names the kind only when every item is of it", () => {
    assert.equal(collectionCountLabel(4, 0), "4 películas");
    assert.equal(collectionCountLabel(1, 0), "1 película");
    assert.equal(collectionCountLabel(3, 3), "3 series");
    assert.equal(collectionCountLabel(1, 1), "1 serie");
  });
});
