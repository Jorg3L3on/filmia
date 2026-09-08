import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  btnGhost,
  btnPrimary,
  btnSecondary,
  buttonClass,
  sheetLayerClass,
  sheetPanelClass,
  toastLayerClass,
} from "./ui";

describe("buttonClass", () => {
  it("exposes primary, secondary, ghost, and danger variants", () => {
    assert.match(btnPrimary, /bg-accent/);
    assert.match(btnSecondary, /hover:bg-chrome-hover/);
    assert.match(btnGhost, /hover:border-line-hover/);
    assert.doesNotMatch(btnSecondary, /#3a4452/);
    assert.doesNotMatch(btnGhost, /#555/);
  });

  it("marks pending and supports sizes", () => {
    const pending = buttonClass({ pending: true, size: "lg" });
    assert.match(pending, /cursor-wait/);
    assert.match(pending, /px-8/);
  });
});

describe("sheet tokens", () => {
  it("uses the shared radius, overlay z-index, and safe-area padding", () => {
    const panel = sheetPanelClass();
    assert.match(panel, /rounded-t-sheet/);
    assert.match(panel, /sm:rounded-sheet/);
    assert.match(panel, /safe-area-inset-bottom/);
    assert.equal(sheetLayerClass.preview, "z-sheet-preview");
    assert.equal(sheetLayerClass.default, "z-sheet");
    assert.equal(sheetLayerClass.top, "z-sheet-top");
    assert.equal(toastLayerClass, "z-toast");
  });
});
