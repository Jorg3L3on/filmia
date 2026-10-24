import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { deckShowsStub, stubToastsItsOwnError } from "@/components/coverflow/deck-stub";

describe("DeckCard stub", () => {
  it("shows the stub on a full unseen card, including outside Hoy", () => {
    assert.equal(deckShowsStub(false, false), true);
    assert.equal(deckShowsStub(false, undefined), true);
    assert.equal(deckShowsStub(true, false), false);
    assert.equal(deckShowsStub(false, true), false);
  });

  it("lets the sheet toast unless Hoy is actually listening", () => {
    assert.equal(stubToastsItsOwnError(null), true);
    assert.equal(stubToastsItsOwnError(undefined), true);
    assert.equal(stubToastsItsOwnError({}), true);
    assert.equal(stubToastsItsOwnError({ onWatchError: () => undefined }), false);
  });
});
