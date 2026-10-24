import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ConfirmDialog } from "@/components/ConfirmDialog";

const channel = (value: number) => {
  const scaled = value / 255;
  return scaled <= 0.04045 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
};

const luminance = (hex: string) => {
  const raw = hex.replace("#", "");
  const red = channel(Number.parseInt(raw.slice(0, 2), 16));
  const green = channel(Number.parseInt(raw.slice(2, 4), 16));
  const blue = channel(Number.parseInt(raw.slice(4, 6), 16));
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
};

const contrast = (foreground: string, background: string) => {
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((left, right) => right - left);
  return (lighter + 0.05) / (darker + 0.05);
};

const walk = async (dir: string): Promise<string[]> => {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return walk(full);
      return full.endsWith(".ts") || full.endsWith(".tsx") ? [full] : [];
    }),
  );
  return nested.flat();
};

describe("ConfirmDialog", () => {
  it("is an alertdialog with Cancel as the initial focus target, the verb, and an inline error", () => {
    const html = renderToStaticMarkup(
      createElement(ConfirmDialog, {
        open: true,
        onClose: () => {},
        onConfirm: () => {},
        title: "¿Eliminar «Noches de patio»?",
        description: "Contiene 2 títulos. Tus películas y series no se borran.",
        confirmLabel: "Eliminar lista",
        error: "No se pudo borrar.",
      }),
    );

    assert.match(html, /role="alertdialog"/);
    assert.match(html, /aria-modal="true"/);
    const labelled = /aria-labelledby="([^"]+)"/.exec(html);
    const described = /aria-describedby="([^"]+)"/.exec(html);
    assert.ok(labelled);
    assert.ok(described);
    assert.match(html, new RegExp(`id="${labelled[1]}"`));
    assert.match(html, new RegExp(`id="${described[1]}"`));
    assert.match(html, /¿Eliminar «Noches de patio»\?/);
    assert.match(html, /Contiene 2 títulos\. Tus películas y series no se borran\./);
    assert.match(html, /<button[^>]*data-initial-focus="true"[^>]*>Cancelar<\/button>/);
    assert.match(html, /Eliminar lista/);
    assert.match(html, /min-h-12/);
    assert.match(html, /role="alert"/);
    assert.match(html, /No se pudo borrar\./);
    assert.match(html, /bg-\[rgb\(5_6_7\/0\.55\)\]/);
    assert.match(html, /safe-area-inset-top/);
    assert.match(html, /safe-area-inset-bottom/);
  });

  it("fades without travel and keeps text and controls readable on the crystal", async () => {
    const css = await readFile("src/app/globals.css", "utf8");
    assert.match(css, /@media \(prefers-reduced-transparency: reduce\)/);
    assert.match(css, /\.glass-panel\.glass-alert/);
    assert.match(css, /backdrop-filter: none/);
    const fade = /@keyframes confirm-fade-in \{([\s\S]*?)\}/.exec(css);
    const fadeOut = /@keyframes confirm-fade-out \{([\s\S]*?)\}/.exec(css);
    assert.ok(fade);
    assert.ok(fadeOut);
    assert.doesNotMatch(fade[1], /translate|transform/);
    assert.doesNotMatch(fadeOut[1], /translate|transform/);
    assert.match(css, /#14060a/);
    assert.match(css, /#e5485a/);
    assert.match(css, /#ff7d8b/);
    const dialog = await readFile("src/components/ConfirmDialog.tsx", "utf8");
    assert.match(dialog, /#c9cfd5/);
    assert.match(dialog, /#8b939c/);

    const glass = "#10141c";
    const solid = "#181c23";
    assert.ok(contrast("#f0f2f4", glass) >= 4.5);
    assert.ok(contrast("#f0f2f4", solid) >= 4.5);
    assert.ok(contrast("#c9cfd5", glass) >= 4.5);
    assert.ok(contrast("#c9cfd5", solid) >= 4.5);
    assert.ok(contrast("#14060a", "#e5485a") >= 4.5);
    assert.ok(contrast("#14060a", "#ff7d8b") >= 4.5);
    assert.ok(contrast("#8b939c", glass) >= 3);
    assert.ok(contrast("#e5485a", glass) >= 3);
    assert.ok(contrast("#ff7d8b", glass) >= 3);
  });

  it("leaves no window.confirm or window.alert in src outside tests", async () => {
    const files = await walk(path.join(process.cwd(), "src"));
    const hits: string[] = [];
    for (const file of files) {
      if (file.endsWith(".test.ts") || file.endsWith(".test.tsx")) continue;
      const source = await readFile(file, "utf8");
      if (/window\.(confirm|alert)\s*\(/.test(source)) hits.push(path.relative(process.cwd(), file));
    }
    assert.deepEqual(hits, []);
  });
});
