import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { build } from "esbuild";
import { chromium, type Browser } from "playwright";

const root = path.resolve(import.meta.dirname, "../..");

const harness = `
import { createRoot } from "react-dom/client";
import { createElement } from "react";
import { ToastCard } from "@/components/Toast";

window.__toastLog = [];

const success = {
  id: 1,
  title: "Añadida a tu diario",
  description: "Dune: Parte dos",
  variant: "success",
  count: 1,
  durationMs: 7000,
  remainingMs: 7000,
  deadline: null,
  held: false,
  action: { label: "Deshacer", onClick: () => window.__toastLog.push("deshacer") },
};

const errorToast = {
  id: 2,
  title: "No se pudo guardar",
  description: "Reintenta en un momento.",
  variant: "error",
  count: 1,
  durationMs: null,
  remainingMs: null,
  deadline: null,
  held: false,
  action: { label: "Reintentar", onClick: () => window.__toastLog.push("reintentar") },
};

const warning = {
  id: 3,
  title: "Sin conexión",
  description: "Se guardará cuando vuelva la red",
  variant: "warning",
  count: 1,
  durationMs: null,
  remainingMs: null,
  deadline: null,
  held: false,
};

const mount = document.getElementById("root");
if (mount) {
  createRoot(mount).render(
    createElement(
      "div",
      null,
      createElement(ToastCard, {
        toast: success,
        onDismiss: () => window.__toastLog.push("dismiss-success"),
      }),
      createElement(ToastCard, {
        toast: errorToast,
        onDismiss: () => window.__toastLog.push("dismiss-error"),
      }),
      createElement(ToastCard, {
        toast: warning,
        onDismiss: () => window.__toastLog.push("dismiss-warning"),
      }),
    ),
  );
}
`;

const launch = async (): Promise<Browser> => {
  const options = { headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] };
  try {
    return await chromium.launch({ ...options, channel: "chrome" });
  } catch {
    try {
      return await chromium.launch(options);
    } catch {
      execFileSync(process.execPath, [path.join(root, "node_modules/playwright/cli.js"), "install", "chromium"], {
        cwd: root,
        stdio: "inherit",
      });
      return chromium.launch(options);
    }
  }
};

describe("toast buttons", () => {
  it("runs Deshacer and the close control from a mouse click", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "toast-click-"));
    const bundle = path.join(dir, "toast-click.js");
    try {
      await build({
        stdin: {
          contents: harness,
          loader: "tsx",
          resolveDir: root,
          sourcefile: "toast-click-harness.tsx",
        },
        bundle: true,
        format: "iife",
        platform: "browser",
        outfile: bundle,
        jsx: "automatic",
        alias: { "@": path.join(root, "src") },
        define: { "process.env.NODE_ENV": '"development"' },
        logLevel: "silent",
      });

      const browser = await launch();
      try {
        const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
        await page.setContent('<div id="root"></div>');
        await page.addScriptTag({ content: await readFile(bundle, "utf8") });
        await page.getByRole("button", { name: "Deshacer" }).click();
        await page.locator('[data-variant="error"] button[aria-label="Cerrar aviso"]').click();
        const card = page.locator('[data-variant="warning"]');
        const box = await card.boundingBox();
        assert.ok(box);
        await page.mouse.move(box.x + 24, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width - 8, box.y + box.height / 2, { steps: 6 });
        await page.mouse.up();
        const log = await page.evaluate(() => (window as unknown as { __toastLog: string[] }).__toastLog);
        assert.deepEqual(log, ["deshacer", "dismiss-success", "dismiss-error", "dismiss-warning"]);
      } finally {
        await browser.close();
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
