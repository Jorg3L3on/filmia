// Shared helpers for the mazo perf scripts (FIL-I58): launch Chrome as a phone, sign in with the
// local audit seed account. Run from the repo root. Env: PERF_BASE (server URL, default
// http://127.0.0.1:3061), PERF_OUT (output folder, default <tmp>/filmia-perf).
import { createRequire } from "node:module";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";

export const REPO = process.cwd();
const require = createRequire(path.join(REPO, "package.json"));
export const { chromium, devices } = require("playwright");

export const BASE = process.env.PERF_BASE ?? "http://127.0.0.1:3061";
export const OUT = process.env.PERF_OUT ?? path.join(tmpdir(), "filmia-perf");
mkdirSync(OUT, { recursive: true });
const STATE = path.join(OUT, ".auth-state.json");

const seed = readFileSync(path.join(REPO, "scripts/seed-audit.ts"), "utf8");
const block = seed.slice(seed.indexOf('email: "normal@auditoria.test"'));
const email = "normal@auditoria.test";
const password = block.match(/password:\s*"([^"]+)"/)?.[1];

export const launch = async ({ gpu = true, extraArgs = [] } = {}) => {
  const args = [
    "--enable-precise-memory-info",
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
    "--disable-backgrounding-occluded-windows",
    ...extraArgs,
  ];
  if (!gpu) args.push("--disable-gpu");
  return chromium.launch({ headless: true, channel: "chrome", args });
};

export const phoneContext = async (browser, { width = 390, height = 844, scale = 3 } = {}) => {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: scale,
    isMobile: true,
    hasTouch: true,
    colorScheme: "dark",
    locale: "es-MX",
    timezoneId: "America/Mexico_City",
    userAgent: devices["Pixel 7"].userAgent,
    storageState: existsSync(STATE) ? STATE : undefined,
  });
  return context;
};

export const signIn = async (context) => {
  const page = await context.newPage();
  page.setDefaultTimeout(90000);
  await page.goto(`${BASE}/perfil`, { waitUntil: "load" });
  await page.waitForTimeout(800);
  if (new URL(page.url()).pathname.startsWith("/login")) {
    await page.fill('input[type="email"], input[name="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 90000 });
    await page.waitForLoadState("load");
    await context.storageState({ path: STATE });
  }
  return page;
};

export const openHoy = async (page) => {
  await page.goto(`${BASE}/`, { waitUntil: "load" });
  await page.waitForSelector('[role="listbox"][aria-label="Mazo de títulos"]', { timeout: 90000 });
  // Let the deal animation, image decodes and the lite warm-up pass.
  await page.waitForTimeout(4500);
};
