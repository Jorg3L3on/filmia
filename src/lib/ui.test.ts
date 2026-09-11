import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  btnDanger,
  btnGhost,
  btnPrimary,
  btnSecondary,
  btnSuccess,
  buttonClass,
  sheetLayerClass,
  sheetOverlayClass,
  sheetPanelClass,
  toastLayerClass,
} from "./ui";

describe("buttonClass", () => {
  it("exposes primary, secondary, ghost, danger, and success variants", () => {
    assert.match(btnPrimary, /bg-accent/);
    assert.match(btnPrimary, /text-ink/);
    assert.match(btnSecondary, /border-accent/);
    assert.match(btnGhost, /text-fog/);
    assert.doesNotMatch(btnGhost, /border-chrome/);
    assert.match(btnDanger, /bg-danger/);
    assert.match(btnSuccess, /bg-success/);
  });

  it("uses 32/40/48 sizes and button radius token", () => {
    const sm = buttonClass({ size: "sm" });
    const md = buttonClass({ size: "md" });
    const lg = buttonClass({ size: "lg" });
    assert.match(sm, /h-8/);
    assert.match(md, /h-10/);
    assert.match(lg, /h-12/);
    assert.match(md, /rounded-\[var\(--radius-button\)\]/);
  });

  it("marks pending", () => {
    const pending = buttonClass({ pending: true, size: "lg" });
    assert.match(pending, /cursor-wait/);
  });
});

describe("sheet tokens", () => {
  it("uses well surface, 60% overlay, z-50, radius, and safe-area", () => {
    const panel = sheetPanelClass();
    assert.match(panel, /rounded-t-sheet/);
    assert.match(panel, /bg-well/);
    assert.match(panel, /sm:rounded-sheet/);
    assert.match(panel, /safe-area-inset-bottom/);
    assert.match(panel, /sheet-rise/);
    assert.match(sheetOverlayClass, /bg-canvas-deep\/60/);
    assert.equal(sheetLayerClass.preview, "z-sheet-preview");
    assert.equal(sheetLayerClass.default, "z-50");
    assert.equal(sheetLayerClass.top, "z-sheet-top");
    assert.equal(toastLayerClass, "z-toast");
  });
});
