/**
 * Portrait iOS startup PNGs, one per device. Each file is a headless Chrome
 * screenshot of the real Iris CSS at t = 0 (animations paused, the same
 * next/font files). The iPhone 14 Pro frame is checked against a second shot
 * of that page at 600ms — the file on disk, after compression.
 *
 * pngquant's 256-color palette moves channels by dozens on this grain, so it
 * cannot stay inside a max channel delta of 3. The shrink is a posterize of
 * at most 2 levels (no banding; the grain already dithers the gradients),
 * kept only when that delta still holds, then lossless oxipng.
 *
 * Requires a production build so the shot uses the shipped CSS and fonts:
 *   npm run build && npm run generate:ios-splash
 *
 * Optional argv filters the device list (a size like 393x852, or a name).
 */
import { createServer } from "node:http";
import { spawnSync, execFileSync } from "node:child_process";
import { readFileSync, readdirSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const devices = JSON.parse(
  readFileSync(path.join(root, "src/lib/pwa/ios-splash-devices.json"), "utf8"),
);
const outDir = path.join(root, "public/splash");
const filter = process.argv[2]?.toLowerCase() ?? "";

const cssFiles = readdirSync(path.join(root, ".next/static/chunks"))
  .filter((name) => name.endsWith(".css"))
  .map((name) => path.join(root, ".next/static/chunks", name));

if (cssFiles.length === 0) {
  throw new Error("No built CSS. Run npm run build before generate:ios-splash.");
}

const cssText = cssFiles.map((file) => readFileSync(file, "utf8")).join("\n");
const fontClass = (variable) => {
  const match = cssText.match(new RegExp(`\\.([\\w-]+)\\{[^}]*${variable}\\s*:`));
  if (!match) throw new Error(`Built CSS is missing ${variable}`);
  return match[1];
};

const markup = spawnSync(
  path.join(root, "node_modules/.bin/tsx"),
  [
    "-e",
    `import { renderToStaticMarkup } from "react-dom/server";
     import { createElement } from "react";
     import { IrisLoader } from "./src/components/launch/IrisLoader.tsx";
     process.stdout.write(renderToStaticMarkup(createElement(IrisLoader)));`,
  ],
  { cwd: root, encoding: "utf8" },
);
if (markup.status !== 0) {
  throw new Error(markup.stderr || "Could not render IrisLoader");
}

const html = `<!doctype html>
<html class="${fontClass("--font-fraunces")} ${fontClass("--font-geist-sans")}">
<head>
<meta charset="utf-8"/>
${cssFiles.map((file) => `<link rel="stylesheet" href="/_next/static/chunks/${path.basename(file)}"/>`).join("")}
<style>
  html, body { margin: 0; background: #0e1114; }
</style>
</head>
<body>${markup.stdout}</body>
</html>`;

const types = new Map([
  [".css", "text/css; charset=utf-8"],
  [".woff2", "font/woff2"],
  [".png", "image/png"],
  [".html", "text/html; charset=utf-8"],
]);

const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  if (url.pathname === "/") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(html);
    return;
  }
  const rel = decodeURIComponent(url.pathname)
    .replace(/^\/_next\//, ".next/")
    .replace(/^\/+/, "");
  const file = path.join(root, rel);
  if (!file.startsWith(`${root}${path.sep}`)) {
    res.writeHead(403);
    res.end();
    return;
  }
  try {
    const body = readFileSync(file);
    res.writeHead(200, {
      "content-type": types.get(path.extname(file)) ?? "application/octet-stream",
    });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end();
  }
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const { port } = server.address();
const origin = `http://127.0.0.1:${port}`;

const pauseAt = async (page, ms) => {
  await page.evaluate(async (time) => {
    await document.fonts.ready;
    await new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    });
    for (const animation of document.getAnimations()) {
      animation.currentTime = time;
      animation.pause();
    }
  }, ms);
};

const channelDelta = (left, right) => {
  let sum = 0;
  let max = 0;
  let changed = 0;
  const pixels = left.length / 4;
  for (let i = 0; i < left.length; i += 4) {
    const dr = Math.abs(left[i] - right[i]);
    const dg = Math.abs(left[i + 1] - right[i + 1]);
    const db = Math.abs(left[i + 2] - right[i + 2]);
    const peak = Math.max(dr, dg, db);
    sum += dr + dg + db;
    if (peak > max) max = peak;
    if (peak > 0) changed += 1;
  }
  return { mean: sum / pixels, max, changed: changed / pixels };
};

const toRgba = (buffer) => sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

/** Snap each channel to a multiple of `step`. Step 1 is a copy. Max error is step/2. */
const posterize = (rgba, step) => {
  if (step <= 1) return Buffer.from(rgba);
  const copy = Buffer.from(rgba);
  for (let i = 0; i < copy.length; i += 4) {
    copy[i] = Math.min(255, Math.round(copy[i] / step) * step);
    copy[i + 1] = Math.min(255, Math.round(copy[i + 1] / step) * step);
    copy[i + 2] = Math.min(255, Math.round(copy[i + 2] / step) * step);
  }
  return copy;
};

const writePng = async (file, rgba, width, height) => {
  await sharp(rgba, { raw: { width, height, channels: 4 } })
    .removeAlpha()
    .png({ compressionLevel: 9 })
    .toFile(file);
  execFileSync("oxipng", ["-o", "4", "--strip", "safe", file], { stdio: "ignore" });
};

const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-gpu", "--hide-scrollbars"],
});

mkdirSync(outDir, { recursive: true });
const selected = devices.filter((device) => {
  if (!filter) return true;
  return (
    device.name.toLowerCase().includes(filter) ||
    `${device.width}x${device.height}` === filter
  );
});
const isReference = (device) => device.width === 393 && device.height === 852;
selected.sort((a, b) => Number(isReference(b)) - Number(isReference(a)));

/** Largest posterize that keeps the reference file within a channel delta of 3. */
let quantStep = 1;

try {
  for (const device of selected) {
    const context = await browser.newContext({
      viewport: { width: device.width, height: device.height },
      deviceScaleFactor: device.ratio,
    });
    const page = await context.newPage();
    const client = await context.newCDPSession(page);
    await client.send("Emulation.setEmulatedMedia", {
      features: [
        { name: "display-mode", value: "standalone" },
        { name: "prefers-reduced-motion", value: "no-preference" },
      ],
    });
    await page.goto(origin, { waitUntil: "networkidle" });
    const shown = await page.evaluate(() => {
      const loader = document.querySelector(".iris-loader");
      const word = document.querySelector(".iris-word");
      const style = getComputedStyle(loader);
      return {
        display: style.display,
        position: style.position,
        fontSize: word ? getComputedStyle(word).fontSize : "",
        standalone: matchMedia("(display-mode: standalone)").matches,
      };
    });
    if (shown.position !== "fixed" || shown.fontSize !== "42px") {
      throw new Error(`Iris CSS did not apply for ${device.name}: ${JSON.stringify(shown)}`);
    }
    // Chrome's media emulation does not implement display-mode. The shipped
    // rule hides Iris outside standalone; the shot is that same loader shown.
    if (!shown.standalone) {
      await page.addStyleTag({ content: ".iris-loader{display:block !important}" });
    }
    await pauseAt(page, 0);
    const fileName = `apple-splash-${device.width * device.ratio}x${device.height * device.ratio}.png`;
    const file = path.join(outDir, fileName);
    const frame0 = await page.screenshot({ type: "png" });
    const shot = await toRgba(frame0);

    if (isReference(device)) {
      await pauseAt(page, 600);
      const css = await toRgba(await page.screenshot({ type: "png" }));
      if (css.info.width !== shot.info.width || css.info.height !== shot.info.height) {
        throw new Error("CSS pose screenshot size does not match the startup PNG");
      }
      quantStep = 1;
      for (const step of [4, 2]) {
        const delta = channelDelta(posterize(shot.data, step), css.data);
        if (delta.max <= 3) {
          quantStep = step;
          break;
        }
      }
      const rgba = posterize(shot.data, quantStep);
      await writePng(file, rgba, shot.info.width, shot.info.height);
      const written = await toRgba(readFileSync(file));
      const delta = channelDelta(written.data, css.data);
      console.log(
        `delta 393x852 @3  png vs css@600ms  step=${quantStep}  max=${delta.max}  mean=${delta.mean.toFixed(4)}  changed=${(delta.changed * 100).toFixed(3)}%`,
      );
      if (delta.max > 3) {
        throw new Error(`Splash delta ${delta.max} exceeds 3`);
      }
    } else {
      await writePng(file, posterize(shot.data, quantStep), shot.info.width, shot.info.height);
    }

    console.log(`wrote public/splash/${fileName} (${device.name})`);
    await context.close();
  }
} finally {
  await browser.close();
  server.close();
}
