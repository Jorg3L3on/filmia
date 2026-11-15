// FIL-I58-5 check: with `?mazo=waapi` a released deck writes no inline style on any card between
// the release and the rest, animations play instead, and the rest matches the rAF release.
//   PERF_BASE=http://127.0.0.1:3067 node scripts/perf/mazo-release-check.mjs
import { launch, phoneContext, signIn } from "./lib.mjs";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const run = async (query) => {
  process.env.PERF_QUERY = query;
  const browser = await launch();
  const context = await phoneContext(browser);
  const page = await signIn(context);
  const { openHoy } = await import("./lib.mjs");
  await openHoy(page);
  const cdp = await context.newCDPSession(page);
  const box = await page.locator('[role="listbox"][aria-label="Mazo de títulos"]').boundingBox();
  const y = Math.round(box.y + box.height * 0.45);
  const touch = (type, x) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y, id: 1 }] });
  await page.evaluate(() => {
    window.__m = { writes: [], t0: 0, anims: 0 };
    const obs = new MutationObserver((list) => { for (const m of list) if (window.__m.t0) window.__m.writes.push([Math.round(performance.now() - window.__m.t0), m.target.className?.toString().slice(0, 30)]); });
    obs.observe(document.querySelector(".coverflow-card-mover").parentElement, { attributes: true, attributeFilter: ["style"], subtree: true });
  });
  const flick = async (dx) => {
    await touch("touchStart", 300);
    for (let i = 1; i <= 6; i++) { await touch("touchMove", 300 + dx * i); await sleep(17); }
    await page.evaluate(() => { window.__m.t0 = performance.now(); window.__m.writes = []; });
    await touch("touchEnd", 0);
    await sleep(120);
    const anims = await page.evaluate(() => document.getAnimations().filter((a) => a.effect?.target?.closest?.(".coverflow-card-mover, .coverflow-card-face, .coverflow-card-dim") || a.effect?.target?.matches?.(".coverflow-card-mover, .coverflow-card-dim, .coverflow-card-face")).length);
    await sleep(1800);
    const rest = await page.evaluate(() => ({
      writes: window.__m.writes,
      hero: document.querySelector(".coverflow-card.is-focused a[data-coverflow-face]")?.getAttribute("href"),
      transforms: [...document.querySelectorAll(".coverflow-card-mover")].map((n) => n.style.transform),
      busy: "deckMoving" in document.documentElement.dataset,
    }));
    return { anims, ...rest };
  };
  const a = await flick(-22);
  const b = await flick(+22);
  await browser.close();
  return { a, b };
};
const waapi = await run("?mazo=waapi");
const raf = await run("?mazo=raf");
const summarize = (r) => ({ animationsPlaying: r.anims, inlineWritesAfterRelease: r.writes.length, firstWrites: r.writes.slice(0, 6), hero: r.hero, deckMovingAfterRest: r.busy });
console.log("waapi flick1", JSON.stringify(summarize(waapi.a)));
console.log("waapi flick2", JSON.stringify(summarize(waapi.b)));
console.log("raf   flick1", JSON.stringify(summarize(raf.a)));
console.log("same hero as raf:", waapi.a.hero === raf.a.hero, waapi.b.hero === raf.b.hero);
const same = waapi.b.transforms.length === raf.b.transforms.length && waapi.b.transforms.every((t, i) => t === raf.b.transforms[i]);
console.log("same resting transforms as raf:", same);
