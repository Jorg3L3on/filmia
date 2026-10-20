import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { planListReorder } from "@/lib/list-reorder";

const current = [
  { id: "a", position: 0 },
  { id: "b", position: 1 },
  { id: "c", position: 2 },
];

describe("planListReorder", () => {
  it("returns only the positions that change", () => {
    assert.deepEqual(planListReorder(current, ["c", "b", "a"]), [
      { id: "c", position: 0 },
      { id: "a", position: 2 },
    ]);
  });

  it("returns nothing when the order is unchanged", () => {
    assert.deepEqual(planListReorder(current, ["a", "b", "c"]), []);
  });

  it("normalizes gaps in stored positions", () => {
    assert.deepEqual(
      planListReorder(
        [
          { id: "a", position: 4 },
          { id: "b", position: 9 },
        ],
        ["a", "b"],
      ),
      [
        { id: "a", position: 0 },
        { id: "b", position: 1 },
      ],
    );
  });

  it("keeps items the client didn't send at the end, in their current order", () => {
    assert.deepEqual(planListReorder(current, ["c"]), [
      { id: "c", position: 0 },
      { id: "a", position: 1 },
      { id: "b", position: 2 },
    ]);
  });

  it("ignores ids that are no longer in the list", () => {
    assert.deepEqual(planListReorder(current, ["b", "gone", "a", "c"]), [
      { id: "b", position: 0 },
      { id: "a", position: 1 },
    ]);
  });

  it("rejects duplicated ids", () => {
    assert.throws(() => planListReorder(current, ["a", "a", "b"]));
  });
});
