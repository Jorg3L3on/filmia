// Scripted swipes on Para ti's spine shelf at a phone viewport under CPU throttle (FIL-I60-5).
// Prints one JSON line: frames measured, p50/p95/max frame time (ms), frames over 20/34 ms, and the
// most spines mounted at once (the shelf keeps a window of at most 25).
//
//   PERF_BASE=http://127.0.0.1:3060 PERF_EMAIL=<seed email> PERF_PASSWORD=<seed password> \
//     npm run perf:para-ti -- --cpu=4 [--antojo=miedo] [--width=375]
//
// Without PERF_EMAIL it signs in with the audit seed account like perf:mazo (scripts/perf/lib.mjs).
// A production build measures what a phone gets; `next dev` overstates React work several times.
import { launch, phoneContext, signIn, BASE } from "./lib.mjs";

const args = process.argv.slice(2);
const flag = (n, d) => { const a = args.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const cpu = Number(flag("cpu", 4));
const antojo = flag("antojo", "miedo");
const width = Number(flag("width", 375));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await launch();
const context = await phoneContext(browser, { width, height: 812, scale: 3 });
let page;
if (process.env.PERF_EMAIL) {
  page = await context.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "load" });
  await page.fill('input[type="email"]', process.env.PERF_EMAIL);
  await page.fill('input[type="password"]', process.env.PERF_PASSWORD ?? "");
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 90000 }), page.press('input[type="password"]', "Enter")]);
} else {
  page = await signIn(context);
}

await context.addInitScript(() => {
  window.__shelf = { on: false, frames: [], maxMounted: 0 };
  const P = window.__shelf;
  let last = 0;
  const loop = (t) => {
    if (P.on) {
      if (last) P.frames.push(t - last);
      last = t;
      P.maxMounted = Math.max(P.maxMounted, document.querySelectorAll("[data-spine-face]").length);
    } else {
      last = 0;
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
});
await page.goto(`${BASE}/para-ti?antojo=${antojo}`, { waitUntil: "load" });
await page.waitForSelector("[data-shelf-track] [data-spine-face]", { timeout: 90000 });
await sleep(2500);

const cdp = await context.newCDPSession(page);
await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpu });
const box = await page.locator("[data-shelf-track]").boundingBox();
const y = Math.round(box.y + box.height / 2);
const touch = (type, x) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y, id: 1, radiusX: 8, radiusY: 8, force: 1 }] });
/** Drag from x0 by dx over ms, then release (a flick when fast). */
const drag = async (x0, dx, ms) => {
  const steps = Math.max(2, Math.round(ms / 16.7));
  await touch("touchStart", x0);
  const t0 = performance.now();
  for (let i = 1; i <= steps; i++) {
    await touch("touchMove", x0 + (dx * i) / steps);
    const wait = t0 + (ms * i) / steps - performance.now();
    if (wait > 0) await sleep(wait);
  }
  await touch("touchEnd", 0);
};

await page.evaluate(() => { window.__shelf.on = true; });
// Slow drags, flicks both ways, a long fling.
await drag(300, -160, 500); await sleep(900);
await drag(320, -260, 180); await sleep(1300);
await drag(60, 220, 160); await sleep(1300);
await drag(330, -300, 120); await sleep(1600);
await drag(50, 300, 140); await sleep(1600);
const result = await page.evaluate(() => { window.__shelf.on = false; return window.__shelf; });
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });

const frames = result.frames.filter((f) => f > 0).sort((a, b) => a - b);
const pct = (q) => frames[Math.min(frames.length - 1, Math.floor(q * frames.length))] ?? 0;
console.log(JSON.stringify({
  antojo,
  width,
  cpu,
  frames: frames.length,
  p50: +pct(0.5).toFixed(1),
  p95: +pct(0.95).toFixed(1),
  max: +(frames.at(-1) ?? 0).toFixed(1),
  over20: frames.filter((f) => f > 20).length,
  over34: frames.filter((f) => f > 34).length,
  maxMounted: result.maxMounted,
}));
await browser.close();
