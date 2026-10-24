import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { describe, it } from "node:test";
import type { Browser, Page } from "playwright";

const require = createRequire(import.meta.url);
const BENCH = "http://127.0.0.1:3000/alertas-sala";

describe("toast copy at 375", () => {
  it("keeps every production title on at most two lines, with no ellipsis", async (t) => {
    const up = await fetch(BENCH)
      .then((response) => response.ok)
      .catch(() => false);
    if (!up) {
      t.skip("the alertas bench is not running");
      return;
    }

    const { chromium } = require("playwright") as {
      chromium: { launch: (options?: { headless?: boolean }) => Promise<Browser> };
    };
    const browser = await chromium.launch({ headless: true });
    try {
      for (const width of [375, 390]) {
        const page = await browser.newPage({ viewport: { width, height: 900 } });
        await page.goto(BENCH, { waitUntil: "domcontentloaded" });
        await page.evaluate(() => document.fonts.ready);
        await page.locator("#toast-fit .toast-title").first().waitFor();
        const overflow = await measure(page);
        assert.deepEqual(
          overflow.filter((row) => row.bad),
          [],
          `${width}px cuts a toast: ${JSON.stringify(overflow.filter((row) => row.bad))}`,
        );
        await page.close();
      }
    } finally {
      await browser.close();
    }
  });
});

const measure = (page: Page) =>
  page.evaluate(() => {
    const scope = document.querySelectorAll("#toast-fit .toast, #zona-a .toast, #zona-b .toast, #zona-c .toast");
    return [...scope].flatMap((toast) => {
      const title = toast.querySelector<HTMLElement>(".toast-title");
      const sub = toast.querySelector<HTMLElement>(".toast-sub");
      const action = toast.querySelector<HTMLElement>(".toast-action");
      const rows = [title, sub].filter((node): node is HTMLElement => node != null);
      return rows.map((node) => {
        const style = getComputedStyle(node);
        const lineHeight = Number.parseFloat(style.lineHeight);
        const height = node.getBoundingClientRect().height;
        const lines = linesSafe(height, lineHeight);
        const titleNode = node.classList.contains("toast-title");
        const clipped = node.scrollWidth > node.clientWidth + 1 || style.textOverflow === "ellipsis" || style.whiteSpace === "nowrap";
        const tooTall = titleNode && lines > 2;
        const actionDrops =
          !titleNode ||
          !action ||
          action.getBoundingClientRect().top >= node.getBoundingClientRect().bottom - 1;
        return {
          bad: clipped || tooTall || !actionDrops,
          text: node.textContent,
          lines,
          clipped,
          tooTall,
          actionDrops,
          whiteSpace: style.whiteSpace,
        };
      });
    });

    function linesSafe(height: number, lineHeight: number) {
      if (!Number.isFinite(lineHeight) || lineHeight <= 0) {
        return 1;
      }
      return Math.max(1, Math.round(height / lineHeight));
    }
  });
