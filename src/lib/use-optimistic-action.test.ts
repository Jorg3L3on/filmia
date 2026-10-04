import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sameIdList, sameOrderedIds, swapAdjacentIds } from "./optimistic-ids";

describe("swapAdjacentIds", () => {
  it("moves an id up and down", () => {
    assert.deepEqual(swapAdjacentIds(["a", "b", "c"], "b", "up"), ["b", "a", "c"]);
    assert.deepEqual(swapAdjacentIds(["a", "b", "c"], "b", "down"), ["a", "c", "b"]);
  });

  it("keeps the list when the move is out of range", () => {
    const ids = ["a", "b"];
    assert.equal(swapAdjacentIds(ids, "a", "up"), ids);
    assert.equal(swapAdjacentIds(ids, "b", "down"), ids);
    assert.equal(swapAdjacentIds(ids, "missing", "up"), ids);
  });
});

describe("id list helpers", () => {
  it("compares unsorted membership and ordered sequences", () => {
    assert.equal(sameIdList(["b", "a"], ["a", "b"]), true);
    assert.equal(sameOrderedIds(["b", "a"], ["a", "b"]), false);
    assert.equal(sameOrderedIds(["a", "b"], ["a", "b"]), true);
  });
});
