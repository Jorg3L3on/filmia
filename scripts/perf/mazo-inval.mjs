// Why does one frame of a swipe recalculate ~80 elements' style? Trace with invalidation tracking
// during a slow drag, then group the invalidated nodes by reason; also list render-pass reasons.
import { launch, phoneContext, signIn, openHoy } from "./lib.mjs";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await launch();
const context = await phoneContext(browser);
const page = await signIn(context);
await openHoy(page);
const cdp = await context.newCDPSession(page);
const box = await page.locator('[role="listbox"][aria-label="Mazo de títulos"]').boundingBox();
const y = Math.round(box.y + box.height * 0.45);
const touch = (type, x) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y, id: 1 }] });
const flick = async () => { await touch("touchStart", 300); for (let i = 1; i <= 6; i++) { await touch("touchMove", 300 - i * 22); await sleep(17); } await touch("touchEnd", 0); await sleep(900); };
for (let i = 0; i < 5; i++) await flick();
await sleep(1500);


const CATS = ["devtools.timeline", "disabled-by-default-devtools.timeline", "disabled-by-default-devtools.timeline.invalidationTracking"];
const top = (o, n = 30) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n);
const analyse = (label, events) => {
  const reasons = {}, nodes = {};
  const recalc = [];
  for (const e of events) {
    if (e.name === "UpdateLayoutTree" && e.ph === "X") recalc.push({ n: e.args?.elementCount || 0, ms: e.dur / 1000 });
    if (e.name === "StyleRecalcInvalidationTracking" || e.name === "StyleInvalidatorInvalidationTracking" || e.name === "ScheduleStyleInvalidationTracking") {
      const d = e.args?.data || {};
      const why = `${d.reason || d.invalidationSet || ""} ${d.extraData || ""} ${d.changedClass ? "class:" + d.changedClass : ""}${d.changedAttribute ? "attr:" + d.changedAttribute : ""}${d.changedPseudo ? "pseudo:" + d.changedPseudo : ""}`.trim();
      const key = `${e.name.replace("InvalidationTracking", "")} | ${why}`;
      reasons[key] = (reasons[key] || 0) + 1;
      const nk = `${(d.nodeName || "?").slice(0, 70)} <- ${why}`;
      nodes[nk] = (nodes[nk] || 0) + 1;
    }
  }
  const ns = recalc.map((r) => r.n).sort((a, b) => a - b);
  const q = (p) => ns[Math.min(ns.length - 1, Math.floor(ns.length * p))];
  const big = recalc.filter((r) => r.n > 200);
  console.log(`\n===== ${label}: ${recalc.length} recalcs; elements p50 ${q(0.5)} p90 ${q(0.9)} max ${q(1)}; total ${recalc.reduce((s, r) => s + r.n, 0)} elements, ${recalc.reduce((s, r) => s + r.ms, 0).toFixed(0)} ms; recalcs over 200 elements: ${big.length} (${big.reduce((s, r) => s + r.ms, 0).toFixed(0)} ms, sizes ${big.map((r) => r.n).slice(0, 12).join(",")})`);
  console.log("--- invalidation reasons ---");
  for (const [k, v] of top(reasons, 14)) console.log(String(v).padStart(6), k.slice(0, 170));
  console.log("--- nodes ---");
  for (const [k, v] of top(nodes, 34)) console.log(String(v).padStart(6), k.slice(0, 170));
};

// A: a slow drag that stays inside one card (no crossing): the pure per-frame cost.
await browser.startTracing(page, { categories: CATS });
await touch("touchStart", 300);
for (let i = 1; i <= 40; i++) { await touch("touchMove", 300 - 12 - i * 0.9); await sleep(17); }
await sleep(100);
for (let i = 40; i >= 0; i--) { await touch("touchMove", 300 - 12 - i * 0.9); await sleep(17); }
await touch("touchEnd", 0);
await sleep(700);
analyse("A slow drag, no crossing", JSON.parse((await browser.stopTracing()).toString()).traceEvents);

// B: three flicks (crossings, release, settle, new resting card).
await browser.startTracing(page, { categories: CATS });
for (let i = 0; i < 3; i++) await flick();
analyse("B three flicks", JSON.parse((await browser.stopTracing()).toString()).traceEvents);
await browser.close();
