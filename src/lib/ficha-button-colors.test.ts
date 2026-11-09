import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { contrastRatio, fichaButtonColors, MIN_BUTTON_CONTRAST, parseCssRgb } from "./ficha-button-colors";

const INK = { r: 14, g: 17, b: 20 };
const PAPER = { r: 240, g: 242, b: 244 };

// Ten posterAmbient values sampled from the local catalog (Catalog.posterAmbient), plus edge cases.
const TITLES = [
  "198 145 76",
  "152 157 137",
  "255 73 61",
  "167 140 103",
  "58 128 215",
  "197 163 102",
  "109 123 146",
  "136 119 109",
  "171 109 75",
  "174 112 35",
  "241 93 23",
  "124 156 255",
];

describe("fichaButtonColors (FIL-I46-2)", () => {
  it("text reaches ≥ 4.5:1 against both stops on ten catalog posters, or keeps the orange", () => {
    let tinted = 0;
    for (const ambient of TITLES) {
      const colors = fichaButtonColors(ambient);
      if (!colors) continue;
      tinted += 1;
      const text = colors.text === "ink" ? INK : PAPER;
      for (const stop of [colors.from, colors.to]) {
        assert.ok(contrastRatio(text, parseCssRgb(stop)) >= MIN_BUTTON_CONTRAST, `${ambient} → ${stop}`);
      }
    }
    assert.ok(tinted >= 8, `most posters get their own colors (${tinted}/12)`);
  });

  it("keeps the orange for grey or missing ambients", () => {
    assert.equal(fichaButtonColors(null), null);
    assert.equal(fichaButtonColors("garbage"), null);
    assert.equal(fichaButtonColors("128 128 128"), null);
  });

  it("measures contrast the WCAG way", () => {
    assert.ok(Math.abs(contrastRatio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 }) - 21) < 0.01);
    assert.equal(contrastRatio(INK, INK), 1);
  });
});
