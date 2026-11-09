import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { characterInSpanish } from "@/lib/character-notes";

describe("characterInSpanish (FIL-I44-14)", () => {
  it("translates TMDB's credit notes", () => {
    assert.equal(characterInSpanish("Tadeo Jones (voice)"), "Tadeo Jones (voz)");
    assert.equal(characterInSpanish("Guard (uncredited)"), "Guard (sin acreditar)");
    assert.equal(characterInSpanish("Himself (archive footage)"), "Himself (material de archivo)");
    assert.equal(characterInSpanish("Elsa (singing voice)"), "Elsa (voz cantada)");
  });

  it("handles two notes and any case", () => {
    assert.equal(characterInSpanish("Mummy / Tupac (Voice) (uncredited)"), "Mummy / Tupac (voz) (sin acreditar)");
  });

  it("leaves names alone", () => {
    assert.equal(characterInSpanish("Voice of Reason"), "Voice of Reason");
    assert.equal(characterInSpanish("Ellie"), "Ellie");
  });
});
