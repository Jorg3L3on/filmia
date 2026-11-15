// Deterministic screenshots of Hoy (loops frozen): at rest and mid-drag, for before/after diffs
// (FIL-I58). Same server recipe as mazo-swipe.mjs. Prints the share of pixels over 8/255 per state;
// two runs of the same build set the noise floor (the bar is 0.05 % of pixels over 8/255).
//   PERF_WIDTH=360 PERF_HEIGHT=780 (default 390x844)
//   npm run perf:mazo:shots -- <label>            npm run perf:mazo:shots -- --diff a b
import { writeFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { launch, phoneContext, signIn, openHoy, OUT } from "./lib.mjs";
import { diff } from "./pngdiff.mjs";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const STATES = ["rest", "drag0.5", "rest2"];
if (process.argv[2] === "--diff") {
  const [a, b] = process.argv.slice(3);
  for (const st of STATES) {
    const d = diff(readFileSync(path.join(OUT, `shot-${a}-${st}.png`)), readFileSync(path.join(OUT, `shot-${b}-${st}.png`)));
    console.log(`${a} vs ${b} @ ${st}: changed ${d.changedPct}% of pixels, >8/255 ${d.over8Pct}%, max delta ${d.maxDelta}`);
  }
  process.exit(0);
}
const label = process.argv[2] || "x";
const browser = await launch();
const context = await phoneContext(browser, { scale: 2, width: Number(process.env.PERF_WIDTH ?? 390), height: Number(process.env.PERF_HEIGHT ?? 844) });
// Wall-clock text («se pasa 37 min») must not change between runs: freeze Date.
await context.addInitScript(() => {
  const RealDate = Date;
  const FIXED = new RealDate("2026-11-14T19:00:00-06:00").getTime();
  Date = class extends RealDate {
    constructor(...a) { if (a.length) super(...a); else super(FIXED); }
    static now() { return FIXED; }
  };
});
const page = await signIn(context);
await openHoy(page);
const cdp = await context.newCDPSession(page);
const box = await page.locator('[role="listbox"][aria-label="Mazo de títulos"]').boundingBox();
const y = Math.round(box.y + box.height * 0.45);
const touch = (type, x) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y, id: 1 }] });
const flick = async () => { await touch("touchStart", 300); for (let i = 1; i <= 6; i++) { await touch("touchMove", 300 - i * 22); await sleep(17); } await touch("touchEnd", 0); await sleep(1000); };
for (let i = 0; i < 5; i++) await flick();
await sleep(2500);
// Every poster decoded before the shot, so image timing is not a difference.
await page.evaluate(() => Promise.all([...document.querySelectorAll(".coverflow-card img")].map((i) => i.decode().catch(() => {}))));
await sleep(500);
// Freeze loops at a fixed phase so two builds can be compared pixel by pixel.
await page.evaluate(() => { for (const a of document.getAnimations()) { try { a.pause(); a.currentTime = 0; } catch {} } });
await page.addStyleTag({ content: `*,*::before,*::after{animation-play-state:paused!important;transition:none!important}.film-grain{display:none!important}` });
await sleep(300);
writeFileSync(path.join(OUT, `shot-${label}-rest.png`), await page.screenshot());
const span = (await page.evaluate(() => document.querySelector(".coverflow-card").offsetWidth)) * 0.52;
await touch("touchStart", 300);
for (let i = 1; i <= 10; i++) { await touch("touchMove", 300 - 12 - (span * 0.5 * i) / 10); await sleep(20); }
await sleep(300);
writeFileSync(path.join(OUT, `shot-${label}-drag0.5.png`), await page.screenshot());
for (let i = 10; i >= 0; i--) { await touch("touchMove", 300 - 12 - (span * 0.5 * i) / 10); await sleep(15); }
await touch("touchEnd", 0);
await sleep(1200);
writeFileSync(path.join(OUT, `shot-${label}-rest2.png`), await page.screenshot());
await browser.close();
console.log("shots", label);
