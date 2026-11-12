/**
 * Portrait iOS startup PNGs, one per device. Each file is a headless Chrome
 * screenshot of the real launch loader (FIL-43: the canvas, a faint glow and
 * the F) with the shipped CSS at t = 0. The iPhone 14 Pro frame is checked
 * against a second shot of that page at 600ms — the file on disk, after
 * compression — so the live loader's first frames match the PNG.
 *
 * The art is flat apart from one faint glow, so the PNGs are lossless
 * (sharp + oxipng); no posterize, which would band the glow.
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

const markup = spawnSync(
  path.join(root, "node_modules/.bin/tsx"),
  [
    "-e",
    `import { renderToStaticMarkup } from "react-dom/server";
     import { createElement } from "react";
     import { LaunchMark } from "./src/components/launch/LaunchMark.tsx";
     process.stdout.write(renderToStaticMarkup(
       createElement("div", { className: "launch-loader" }, createElement(LaunchMark)),
     ));`,
  ],
  { cwd: root, encoding: "utf8" },
);
if (markup.status !== 0) {
  throw new Error(markup.stderr || "Could not render LaunchMark");
}

const html = `<!doctype html>
<html>
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

let warnedOxipng = false;

const writePng = async (file, rgba, width, height) => {
  await sharp(rgba, { raw: { width, height, channels: 4 } })
    .removeAlpha()
    .png({ compressionLevel: 9 })
    .toFile(file);
  try {
    execFileSync("oxipng", ["-o", "4", "--strip", "safe", file], { stdio: "ignore" });
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    // oxipng is optional (brew install oxipng): it only shrinks the lossless file.
    if (!warnedOxipng) console.warn("oxipng not found: PNGs left as sharp wrote them");
    warnedOxipng = true;
  }
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
    // Chrome's media emulation does not implement display-mode. The shipped
    // rule hides the loader outside standalone; the shot is that same loader shown.
    const standalone = await page.evaluate(() => matchMedia("(display-mode: standalone)").matches);
    if (!standalone) {
      await page.addStyleTag({ content: ".launch-loader{display:block !important}" });
    }
    const shown = await page.evaluate(() => {
      const loader = document.querySelector(".launch-loader");
      const mark = document.querySelector(".launch-mark");
      const box = mark ? mark.getBoundingClientRect() : null;
      return {
        position: getComputedStyle(loader).position,
        markWidth: box ? box.width : 0,
        markCenterY: box ? box.top + box.height / 2 : 0,
        viewportHeight: window.innerHeight,
      };
    });
    // The pose the ticket fixes: a 72px F centered at 43% of the height.
    if (
      shown.position !== "fixed" ||
      shown.markWidth !== 72 ||
      Math.abs(shown.markCenterY - shown.viewportHeight * 0.43) > 0.5
    ) {
      throw new Error(`Launch CSS did not apply for ${device.name}: ${JSON.stringify(shown)}`);
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
      await writePng(file, shot.data, shot.info.width, shot.info.height);
      const written = await toRgba(readFileSync(file));
      const delta = channelDelta(written.data, css.data);
      console.log(
        `delta 393x852 @3  png vs css@600ms  max=${delta.max}  mean=${delta.mean.toFixed(4)}  changed=${(delta.changed * 100).toFixed(3)}%`,
      );
      if (delta.max > 3) {
        throw new Error(`Splash delta ${delta.max} exceeds 3`);
      }
    } else {
      await writePng(file, shot.data, shot.info.width, shot.info.height);
    }

    console.log(`wrote public/splash/${fileName} (${device.name})`);
    await context.close();
  }
} finally {
  await browser.close();
  server.close();
}
