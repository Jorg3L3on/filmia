import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

/**
 * FIL-I34-5: every new text in the Quiero ver header and sheets reads at 4.5:1 or more on the
 * darkest surface it sits on, and the controls carry their VoiceOver names.
 */

const css = readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8");
const root = (name: string) => {
  const match = new RegExp(`--${name}: (#[0-9a-f]{6});`).exec(css);
  assert.ok(match, `--${name} is defined`);
  return match[1] as string;
};

const channel = (value: number) => {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16));
  return 0.2126 * channel(r as number) + 0.7152 * channel(g as number) + 0.0722 * channel(b as number);
};
const contrast = (fg: string, bg: string) => {
  const [hi, lo] = [luminance(fg), luminance(bg)].sort((left, right) => right - left);
  return ((hi as number) + 0.05) / ((lo as number) + 0.05);
};
/** A translucent fill over the canvas, as the eye sees it. */
const over = (rgb: [number, number, number], alpha: number, bg: string) => {
  const base = [1, 3, 5].map((index) => parseInt(bg.slice(index, index + 2), 16));
  return `#${rgb.map((value, index) => Math.round(value * alpha + (base[index] as number) * (1 - alpha)).toString(16).padStart(2, "0")).join("")}`;
};

describe("watchlist a11y/contrast", () => {
  const canvas = root("canvas");
  const selected = over([255, 122, 69], 0.17, canvas);
  const pairs: [string, string, string][] = [
    ["count «de 262»", "#8b939c", canvas],
    ["title / labels", root("paper"), canvas],
    ["help lines (mist)", root("mist"), root("surface")],
    ["selected cell label", root("paper"), selected],
    ["accent link «Limpiar filtros»", root("accent"), canvas],
    ["direction arrow", "#ffb08a", canvas],
    ["«Datos parciales» tag", root("affinity"), over([201, 178, 255], 0.16, canvas)],
    ["offline note", "#e9dcb8", over([240, 193, 74], 0.08, canvas)],
    ["badge number", root("ink"), root("accent")],
  ];
  for (const [name, fg, bg] of pairs) {
    it(`${name} ≥ 4.5:1`, () => {
      assert.ok(contrast(fg, bg) >= 4.5, `${name}: ${contrast(fg, bg).toFixed(2)}:1`);
    });
  }
});

describe("watchlist a11y/names", () => {
  const read = (file: string) => readFileSync(path.join(process.cwd(), "src/components/watchlist", file), "utf8");
  it("names the count, funnel, dice, scope, order, direction and chips for VoiceOver", () => {
    const top = read("WatchlistTopBar.tsx");
    assert.match(top, /aria-live="polite"/);
    assert.match(top, /Filtros, \$\{filterCount\}/);
    assert.match(top, /Sorpréndeme\. Baraja lo que ves/);
    assert.match(read("WatchlistScopeBar.tsx"), /Alcance: \$\{label\}/);
    const pill = read("WatchlistOrderPill.tsx");
    assert.match(pill, /Orden: \$\{label\}\. Cambiar/);
    assert.match(pill, /Dirección: \$\{directionSpoken\(direction\)\}\. Invertir/);
    assert.match(read("WatchlistChipRow.tsx"), /Cortas, menos de 100 minutos/);
    assert.match(read("WatchlistFiltersSheet.tsx"), /Ver 0 títulos, sin resultados/);
  });
});
