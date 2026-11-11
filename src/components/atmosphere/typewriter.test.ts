import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { typewriterFrame } from "./useTypewriter";

describe("typewriterFrame (FIL-I46-4)", () => {
  it("types a word, holds it, erases it, then types the next", () => {
    const words = ["Dune", "Up"];
    assert.equal(typewriterFrame(words, 0, 2), "D");
    assert.equal(typewriterFrame(words, 3, 2), "Dune");
    assert.equal(typewriterFrame(words, 5, 2), "Dune");
    assert.equal(typewriterFrame(words, 6, 2), "Dun");
    assert.equal(typewriterFrame(words, 9, 2), "");
    assert.equal(typewriterFrame(words, 10, 2), "U");
  });
});
