import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CLOSING_CARD_ID, closingCardFor, closingCopy, isClosingCard, tallyCount } from "./closing-card";

describe("carta de cierre (FIL-I21-6)", () => {
  it("is one sentinel card carrying the last lens", () => {
    const card = closingCardFor("comedia");
    assert.equal(card.id, CLOSING_CARD_ID);
    assert.equal(card.closing, true);
    assert.equal(card.tonight?.lens, "comedia");
    assert.equal(card.posterPath, null);
    assert.ok(isClosingCard(card));
    assert.ok(!isClosingCard({ id: "abc" }));
  });

  it("counts the night, with a consolation line when nothing was seen", () => {
    assert.deepEqual(closingCopy({ total: 10, watched: 1, notTonight: 2 }), {
      headline: null,
      counters: "10 cartas · 1 vista · 2 «ahora no»",
    });
    assert.deepEqual(closingCopy({ total: 1, watched: 0, notTonight: 0 }), {
      headline: "Ninguna te convenció. Mañana baraja distinto.",
      counters: "1 carta · 0 «ahora no»",
    });
    assert.equal(closingCopy({ total: 4, watched: 3, notTonight: 1 }).counters, "4 cartas · 3 vistas · 1 «ahora no»");
  });
});

describe("la cuenta de la noche sobrevive a recargar", () => {
  it("counts what the server saw plus this visit's new marks, never one twice", () => {
    const counted = [["title-a", "cat-a"], ["cat-b"]];
    assert.equal(tallyCount(counted, new Set()), 2, "a reload keeps tonight's two");
    assert.equal(tallyCount(counted, new Set(["title-a", "cat-c"])), 3, "one already counted, one new");
    assert.equal(tallyCount([], new Set(["cat-c"])), 1);
  });
});
