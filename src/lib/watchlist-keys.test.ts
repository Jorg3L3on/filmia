import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { watchlistKeyAction, type WatchlistKeyTarget } from "@/lib/watchlist-keys";

const none = { meta: false, ctrl: false, alt: false };
const target = (over: Partial<WatchlistKeyTarget>): WatchlistKeyTarget => ({
  editable: false,
  inDialog: false,
  interactive: false,
  inRow: false,
  onPage: false,
  ...over,
});

describe("Quiero ver keys leave focused controls alone (FIL-I41-15)", () => {
  it("Enter on Filtros, Orden or Sorpréndeme is the button's, not the list's", () => {
    assert.equal(watchlistKeyAction("Enter", none, target({ interactive: true })), null);
  });

  it("Enter and V inside an open sheet never open or mark the selected title", () => {
    for (const key of ["Enter", "v", "V", "ArrowDown"]) {
      assert.equal(watchlistKeyAction(key, none, target({ inDialog: true, interactive: true })), null, key);
      assert.equal(watchlistKeyAction(key, none, target({ inDialog: true })), null, key);
    }
  });

  it("↑/↓ + Enter still open the selected title from the list", () => {
    assert.equal(watchlistKeyAction("ArrowDown", none, target({ onPage: true })), "move");
    assert.equal(watchlistKeyAction("Enter", none, target({ onPage: true })), "open");
    assert.equal(watchlistKeyAction("Enter", none, target({ inRow: true })), "open");
    assert.equal(watchlistKeyAction("v", none, target({ onPage: true })), "mark");
  });

  it("Enter on a control inside a row is that control's", () => {
    assert.equal(watchlistKeyAction("Enter", none, target({ inRow: true, interactive: true })), null);
  });

  it("typing and modifiers are ignored", () => {
    assert.equal(watchlistKeyAction("v", none, target({ editable: true, onPage: false })), null);
    assert.equal(watchlistKeyAction("Enter", { ...none, meta: true }, target({ onPage: true })), null);
  });
});
