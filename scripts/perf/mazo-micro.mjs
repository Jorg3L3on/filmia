// Which single write makes Blink restyle a whole card? One property at a time, 60 frames each.
import { launch, phoneContext, signIn, openHoy } from "./lib.mjs";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await launch();
const context = await phoneContext(browser);
const page = await signIn(context);
await openHoy(page);
await page.addStyleTag({ content: process.argv[2] === "quiet" ? `*,*::before,*::after{animation-play-state:paused!important}` : "" });
const tests = {
  nothing: `() => {}`,
  transform: `(c, i) => { c.style.transform = c.style.transform.replace(/translate3d\\(([-\\d.]+)px/, (m, x) => "translate3d(" + (Number(x) + (i % 2 ? 0.1 : -0.1)).toFixed(1) + "px"); }`,
  zIndex: `(c, i) => { c.style.zIndex = String(700 + (i % 2)); }`,
  dimOpacity: `(c, i) => { c.querySelector("[data-coverflow-dim]").style.opacity = (0.3 + (i % 2) * 0.01).toFixed(2); }`,
  faceFilter: `(c, i) => { c.querySelector("[data-coverflow-face]").style.filter = "blur(" + (4 + (i % 2) * 0.5) + "px)"; }`,
  willChange: `(c, i) => { c.style.willChange = i % 2 ? "transform" : "auto"; }`,
  ariaSelected: `(c, i) => { c.setAttribute("aria-selected", i % 2 ? "true" : "false"); }`,
  classFocused: `(c, i) => { c.classList.toggle("is-focused", i % 2 === 0); }`,
};
for (const [name, fn] of Object.entries(tests)) {
  await browser.startTracing(page, { categories: ["devtools.timeline", "disabled-by-default-devtools.timeline"] });
  await page.evaluate(async (src) => {
    const fn = eval(src);
    const cards = [...document.querySelectorAll(".coverflow-card")].filter((c) => !c.classList.contains("is-focused"));
    const card = cards[0];
    for (let i = 0; i < 60; i++) { fn(card, i); await new Promise((r) => requestAnimationFrame(r)); }
  }, fn);
  const events = JSON.parse((await browser.stopTracing()).toString()).traceEvents;
  const rec = events.filter((e) => e.name === "UpdateLayoutTree" && e.ph === "X");
  const ns = rec.map((e) => e.args?.elementCount || 0).sort((a, b) => a - b);
  const sum = (n) => events.filter((e) => e.name === n && e.ph === "X").reduce((s, e) => s + e.dur / 1000, 0);
  console.log(`${name.padEnd(13)} recalcs ${String(rec.length).padStart(3)}  elements median ${String(ns[Math.floor(ns.length / 2)] ?? 0).padStart(3)} max ${String(ns[ns.length - 1] ?? 0).padStart(3)}  style ${sum("UpdateLayoutTree").toFixed(1)} ms  layerize ${sum("Layerize").toFixed(1)}  paint ${(sum("Paint") + sum("PrePaint")).toFixed(1)}  commit ${sum("Commit").toFixed(1)}`);
  await sleep(300);
}
await browser.close();
