import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { catalogGridColumnCount } from "./catalog-grid";

describe("catalog grid columns", () => {
  it("matches grid-cols-2 sm:grid-cols-3 lg:grid-cols-5", () => {
    assert.equal(catalogGridColumnCount(375), 2);
    assert.equal(catalogGridColumnCount(640), 3);
    assert.equal(catalogGridColumnCount(1023), 3);
    assert.equal(catalogGridColumnCount(1024), 5);
  });
});
