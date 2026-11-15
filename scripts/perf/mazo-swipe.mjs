// Scripted swipe on Hoy's mazo under CPU throttle, with a Chrome trace digest (FIL-I58).
// Prints one JSON line: fps, frames over 20/34/50/100 ms, elements restyled per frame, GPU render
// passes per frame, history.replaceState calls, main-thread time by task.
//
//   npm run perf:mazo -- --cpu=6 [--variant=base|gpudiet|nosala|...] [--gpu=0] [--tag=x]
//
// Recipe (a production build; dev mode overstates React 5-6x):
//  1. Local Postgres with the audit seed: TEST_DATABASE_URL=... bash scripts/setup-test-db.sh,
//     then DATABASE_URL=... npm run db:seed:audit (login normal@auditoria.test, password in the seed).
//  2. `next start` refuses a local database in production (NODE_ENV guards in src/db/index.ts and
//     src/instrumentation.ts): in a scratch worktree relax those two guards, copy .env, point both
//     DATABASE_URL vars at the local database, `npm run build`, then `npx next start -p 3061`.
//  3. From the repo root: PERF_BASE=http://127.0.0.1:3061 npm run perf:mazo -- --cpu=6
// Compare builds with `npm run perf:mazo:shots -- <label>` then `-- --diff a b`.
import { writeFileSync } from "node:fs";
import path from "node:path";
import { launch, phoneContext, signIn, openHoy, OUT } from "./lib.mjs";

const args = process.argv.slice(2);
const flag = (n, d) => { const a = args.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const cpu = Number(flag("cpu", 1));
const variant = flag("variant", "base");
const gpu = flag("gpu", "1") !== "0";
const tag = flag("tag", `${variant}-cpu${cpu}${gpu ? "" : "-sw"}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CSS = {
  nosala: `html::before,html::after,.diario-que-ver-shell::before,.diario-que-ver-shell::after{display:none!important}
    .que-ver-atmosphere,.coverflow-soft-glow,.film-grain{display:none!important}`,
  noblend: `*,*::before,*::after{mix-blend-mode:normal!important;-webkit-mask-image:none!important;mask-image:none!important}`,
  nobackdrop: `*,*::before,*::after{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}`,
  noblur: `.coverflow-card-face,.que-ver-atmosphere-ghost,.genre-coverflow-glow{filter:none!important}`,
  noanim: `*,*::before,*::after{animation-play-state:paused!important}`,
  nograin: `.film-grain{display:none!important}`,
};
CSS.nostubglass = `.ticket-stub,.ticket-stub-tab{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}`;
CSS.onlyblend = `*,*::before,*::after{mix-blend-mode:normal!important}`;
CSS.onlymask = `*,*::before,*::after{-webkit-mask-image:none!important;mask-image:none!important}`;
CSS.noactone = `.hoy-act-one{animation:none!important}`;
CSS.iso = `.que-ver-atmosphere{isolation:isolate}`;
CSS.isobg = `.que-ver-atmosphere{isolation:isolate;background:var(--canvas)}`;
CSS.noatmo = `.que-ver-atmosphere{display:none!important}`;
CSS.all = [CSS.nosala, CSS.noblend, CSS.nobackdrop, CSS.noblur, CSS.noanim].join("\n");
CSS.gpudiet = [CSS.noblend, CSS.nobackdrop, CSS.noblur].join("\n");

const browser = await launch({ gpu });
const context = await phoneContext(browser);
await context.addInitScript(() => {
  window.__perf = { raf: [], loaf: [], replace: 0, native: 0, marks: [] };
  const P = window.__perf;
  const nativeReplace = History.prototype.replaceState;
  History.prototype.replaceState = function () { if (P.on) P.native++; return nativeReplace.apply(this, arguments); };
  let last = 0;
  const loop = (t) => { if (P.on) { if (last) P.raf.push(t - last); last = t; } else { last = 0; } requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        if (!P.on) continue;
        P.loaf.push({ dur: Math.round(e.duration), block: Math.round(e.blockingDuration), render: Math.round(e.startTime + e.duration - e.renderStart), style: Math.round(e.startTime + e.duration - e.styleAndLayoutStart),
          scripts: (e.scripts || []).map((s) => ({ d: Math.round(s.duration), inv: s.invoker?.slice(0, 60), fn: s.sourceFunctionName, src: (s.sourceURL || "").split("/").slice(-2).join("/").slice(0, 60), fsl: Math.round(s.forcedStyleAndLayoutDuration) })).filter((s) => s.d >= 2) });
      }
    }).observe({ type: "long-animation-frame", buffered: false });
  } catch {}
});
const page = await signIn(context);
page.on("pageerror", (e) => console.error("pageerror:", e.message));
await openHoy(page);
if (CSS[variant]) await page.addStyleTag({ content: CSS[variant] });
if (variant === "noreplace" || variant === "all") {
  await page.evaluate(() => {
    const orig = history.replaceState;
    history.replaceState = function (d, t, u) { if (String(u).includes("carta=")) return; return orig.apply(this, arguments); };
  });
}
await page.evaluate(() => {
  const orig = history.replaceState;
  history.replaceState = function () { if (window.__perf.on) window.__perf.replace++; return orig.apply(this, arguments); };
});

const cdp = await context.newCDPSession(page);
const box = await page.locator('[role="listbox"][aria-label="Mazo de títulos"]').boundingBox();
const y = Math.round(box.y + box.height * 0.45);
const touch = async (type, x) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y, id: 1, radiusX: 8, radiusY: 8, force: 1 }] });
/** Drag from x0 by dx over ms; release at the end (flick when fast). */
const drag = async (x0, dx, ms, holdMs = 0) => {
  const steps = Math.max(2, Math.round(ms / 16.7));
  await touch("touchStart", x0);
  const t0 = performance.now();
  for (let i = 1; i <= steps; i++) {
    await touch("touchMove", x0 + (dx * i) / steps);
    const due = t0 + (ms * i) / steps;
    const wait = due - performance.now();
    if (wait > 0) await sleep(wait);
  }
  if (holdMs) await sleep(holdMs);
  await touch("touchEnd", 0);
};

// Move into the middle of the deck first (9 cards mounted), untraced.
for (let i = 0; i < 5; i++) { await drag(300, -130, 110); await sleep(900); }
await sleep(1500);
const before = await page.evaluate(() => ({ cards: document.querySelectorAll(".coverflow-card").length, lite: "queVerLite" in document.documentElement.dataset }));

await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpu });
await sleep(400);
await browser.startTracing(page, { categories: ["devtools.timeline", "disabled-by-default-devtools.timeline", "disabled-by-default-devtools.timeline.frame", "benchmark", "cc", "viz", "gpu", "latencyInfo"] });
await page.evaluate(() => { window.__perf.on = true; });

// The gesture: 4 flicks forward, one slow 4-card drag back, 2 flicks back.
const tStart = Date.now();
for (let i = 0; i < 4; i++) { await drag(300, -130, 110); await sleep(750); }
await drag(80, 440, 1100, 80); await sleep(900);
for (let i = 0; i < 2; i++) { await drag(100, 130, 110); await sleep(750); }
const wallMs = Date.now() - tStart;

const perf = await page.evaluate(() => { window.__perf.on = false; return window.__perf; });
const traceBuf = await browser.stopTracing();
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
const after = await page.evaluate(() => ({ lite: "queVerLite" in document.documentElement.dataset }));
writeFileSync(path.join(OUT, `trace-${tag}.json`), traceBuf);

// ---- trace digest ----
const trace = JSON.parse(traceBuf.toString());
const events = trace.traceEvents || trace;
const threadNames = new Map();
for (const e of events) if (e.ph === "M" && e.name === "thread_name") threadNames.set(`${e.pid}:${e.tid}`, e.args.name);
const procNames = new Map();
for (const e of events) if (e.ph === "M" && e.name === "process_name") procNames.set(e.pid, e.args.name);
// The page's renderer: the main thread with the most FunctionCall time.
const byMain = new Map();
for (const e of events) {
  if (e.ph !== "X" || !e.dur) continue;
  const key = `${e.pid}:${e.tid}`;
  if (threadNames.get(key) !== "CrRendererMain") continue;
  byMain.set(key, (byMain.get(key) || 0) + (e.name === "RunTask" ? e.dur : 0));
}
const mainKey = [...byMain.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
const rendererPid = Number(mainKey?.split(":")[0]);
const NAMES = ["RunTask", "FunctionCall", "EventDispatch", "FireAnimationFrame", "UpdateLayoutTree", "Layout", "PrePaint", "Paint", "Layerize", "Commit", "HitTest", "MinorGC", "MajorGC", "V8.GC_SCAVENGER", "ParseHTML", "TimerFire", "RunMicrotasks"];
const main = {};
const other = {};
for (const e of events) {
  if (e.ph !== "X" || !e.dur) continue;
  const key = `${e.pid}:${e.tid}`;
  const tn = threadNames.get(key) || "";
  if (key === mainKey && NAMES.includes(e.name)) main[e.name] = (main[e.name] || 0) + e.dur / 1000;
  if (e.pid === rendererPid && tn.startsWith("Compositor") && ["DrawFrame", "ProxyImpl::ScheduledActionDraw", "LayerTreeHostImpl::PrepareToDraw", "LayerTreeHostImpl::CalculateRenderPasses"].includes(e.name)) other[`cc:${e.name}`] = (other[`cc:${e.name}`] || 0) + e.dur / 1000;
  if (e.pid === rendererPid && /ThreadPool|CompositorTileWorker/.test(tn) && /RasterTask|ImageDecodeTask|Decode/.test(e.name)) other[`raster:${e.name}`] = (other[`raster:${e.name}`] || 0) + e.dur / 1000;
  if ((procNames.get(e.pid) || "").includes("GPU") && ["Display::DrawAndSwap", "SkiaRenderer::DrawFrame", "DirectRenderer::DrawFrame", "SkiaOutputSurfaceImplOnGpu::FinishPaintCurrentFrame", "SkiaOutputSurfaceImplOnGpu::FinishPaintRenderPass", "Graphics.Pipeline.DrawAndSwap"].includes(e.name)) other[`gpu:${e.name}`] = (other[`gpu:${e.name}`] || 0) + e.dur / 1000;
}
let styleElements = 0, styleEvents = 0;
for (const e of events) if (e.name === "UpdateLayoutTree" && e.ph === "X" && `${e.pid}:${e.tid}` === mainKey) { styleEvents++; styleElements += e.args?.elementCount || 0; }
const passes = events.filter((e) => e.name === "SkiaOutputSurfaceImplOnGpu::FinishPaintRenderPass").length;
const swaps = events.filter((e) => e.name === "Display::DrawAndSwap").length;
const count = (name, pidFilter) => events.filter((e) => e.name === name && (pidFilter == null || e.pid === pidFilter)).length;
// Frame outcome from the compositor's own reporter, when the JSON carries it.
const reporter = { presented: 0, dropped: 0, reasons: {} };
for (const e of events) {
  if (e.name !== "PipelineReporter" || (e.ph !== "b" && e.ph !== "B" && e.ph !== "X")) continue;
  const r = e.args?.chrome_frame_reporter;
  if (!r) continue;
  if (String(r.state).includes("DROPPED")) { reporter.dropped++; reporter.reasons[r.reason] = (reporter.reasons[r.reason] || 0) + 1; }
  else if (String(r.state).includes("PRESENTED")) reporter.presented++;
}
const renderPassCounts = events.filter((e) => e.name === "DirectRenderer::DrawFrame" || e.name === "SkiaRenderer::DrawFrame").length;

const raf = perf.raf.slice().sort((a, b) => a - b);
const q = (p) => raf.length ? +raf[Math.min(raf.length - 1, Math.floor(raf.length * p))].toFixed(1) : null;
const round = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, +v.toFixed(0)]));
const summary = {
  tag, cpu, variant, gpu, wallMs, cardsMounted: before.cards, liteBefore: before.lite, liteAfter: after.lite,
  raf: { n: raf.length, fpsAvg: +(raf.length / (raf.reduce((s, v) => s + v, 0) / 1000)).toFixed(1), p50: q(0.5), p90: q(0.9), p99: q(0.99), max: q(1), over20: raf.filter((v) => v > 20).length, over34: raf.filter((v) => v > 34).length, over50: raf.filter((v) => v > 50).length, over100: raf.filter((v) => v > 100).length },
  replaceStateCalls: perf.replace, nativeReplaceState: perf.native,
  style: { events: styleEvents, elementsPerEvent: +(styleElements / Math.max(1, styleEvents)).toFixed(1) },
  renderPasses: { total: passes, swaps, perFrame: +(passes / Math.max(1, swaps)).toFixed(1) },
  loaf: { n: perf.loaf.length, totalBlocking: perf.loaf.reduce((s, l) => s + l.block, 0), worst: perf.loaf.sort((a, b) => b.dur - a.dur).slice(0, 4) },
  mainMs: round(main), otherMs: round(other),
  counts: { drawFrames: count("DrawFrame", rendererPid), commits: count("Commit", rendererPid), paints: count("Paint", rendererPid), updateLayoutTree: count("UpdateLayoutTree", rendererPid), layouts: count("Layout", rendererPid), gpuDraws: renderPassCounts },
  reporter,
};
writeFileSync(path.join(OUT, `summary-${tag}.json`), JSON.stringify(summary, null, 1));
console.log(JSON.stringify(summary));
await browser.close();
