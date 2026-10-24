import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { TOAST_SUBTITLE, toastContrastSamples } from "./toast-contrast";

describe("toast contrast", () => {
  it("clears 4.5:1 for text and 3:1 for controls on light, saturated and poster plates", () => {
    const rows = toastContrastSamples();
    assert.equal(rows.length >= 6, true);
    for (const row of rows) {
      assert.equal(row.title >= 4.5, true, `${row.surface} title ${row.title}`);
      assert.equal(row.subtitle >= 4.5, true, `${row.surface} subtitle ${row.subtitle}`);
      assert.equal(row.action >= 4.5, true, `${row.surface} action ${row.action}`);
      assert.equal(row.close >= 3, true, `${row.surface} close ${row.close}`);
      assert.equal(row.edge >= 3, true, `${row.surface} edge ${row.edge}`);
      assert.equal(row.ring >= 3, true, `${row.surface} ring ${row.ring}`);
      assert.equal(row.icon >= 3, true, `${row.surface} icon ${row.icon}`);
    }
  });

  it("locks the glass tokens and the measured subtitle color in globals.css", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    assert.match(css, /--toast-blur:\s*24px/);
    assert.match(css, /--toast-sat:\s*1\.7/);
    assert.match(css, /--toast-bright:\s*\.62/);
    assert.match(css, /--toast-fill:\s*rgb\(14 17 22 \/ \.58\)/);
    assert.match(css, new RegExp(`--toast-sub:\\s*${TOAST_SUBTITLE}`));
    assert.match(css, /prefers-reduced-transparency:\s*reduce/);
    assert.match(css, /prefers-contrast:\s*more/);
    assert.match(css, /toast-fade-in 120ms/);
    assert.match(css, /@supports not \(backdrop-filter: blur\(1px\)\)/);
  });
});