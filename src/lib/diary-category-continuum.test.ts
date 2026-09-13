import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  categoryHref,
  categoryIndexBySlug,
  coverflowStartIndex,
  resolveCategoryNeighbor,
} from "./diary-category-continuum";

const categories = [
  { slug: "drama", name: "Drama" },
  { slug: "comedia", name: "Comedia" },
  { slug: "accion", name: "Acción" },
] as const;

describe("diary category continuum", () => {
  it("resolves next/prev neighbors in chip order", () => {
    assert.deepEqual(resolveCategoryNeighbor(categories, "drama", "next"), {
      slug: "comedia",
      name: "Comedia",
      startIndex: "first",
    });
    assert.deepEqual(resolveCategoryNeighbor(categories, "comedia", "prev"), {
      slug: "drama",
      name: "Drama",
      startIndex: "last",
    });
    assert.equal(resolveCategoryNeighbor(categories, "drama", "prev"), null);
    assert.equal(resolveCategoryNeighbor(categories, "accion", "next"), null);
  });

  it("maps start index for destination decks", () => {
    assert.equal(coverflowStartIndex(5, "first"), 0);
    assert.equal(coverflowStartIndex(5, "last"), 4);
    assert.equal(coverflowStartIndex(0, "last"), 0);
  });

  it("keeps categoria href and slug index helpers", () => {
    assert.equal(categoryIndexBySlug(categories, "comedia"), 1);
    assert.equal(categoryHref("drama"), "/?categoria=drama");
  });
});
