/**
 * Rasterise Iris frame 0 (the held pose, r = 112px) into one portrait startup
 * PNG per device. The HTML loader shows that PNG until the 0.6s hold ends, so
 * the iOS splash and the first paint are the same image.
 *
 *   npm run generate:ios-splash
 *
 * Geometry matches `.iris-loader` in src/app/globals.css. Portrait only: the
 * manifest locks orientation to portrait, so landscape iPhone art is unused.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const devicesPath = path.join(root, "src/lib/pwa/ios-splash-devices.json");
const outDir = path.join(root, "public/splash");
const fontDir = path.join(root, "scripts/.cache/fonts");

const LAUNCH = "#0e1114";
const FRAUNCES_URL =
  "https://github.com/google/fonts/raw/main/ofl/fraunces/Fraunces%5BSOFT%2CWONK%2Copsz%2Cwght%5D.ttf";
const GEIST_URL =
  "https://github.com/vercel/geist-font/raw/main/packages/next/dist/fonts/geist-sans/Geist-SemiBold.ttf";

const mark = (id) => `
<mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
  <g fill="none" stroke="#fff" stroke-width="16" stroke-linecap="round" stroke-linejoin="round">
    <path d="M22 18V84"/>
    <path d="M22 18H80"/>
    <path d="M22 50H64"/>
  </g>
  <g fill="#000">
    <rect x="18" y="30" width="8" height="6" rx="1.5"/>
    <rect x="18" y="39" width="8" height="6" rx="1.5"/>
    <rect x="18" y="62" width="8" height="6" rx="1.5"/>
    <rect x="18" y="71" width="8" height="6" rx="1.5"/>
    <rect x="40" y="14" width="6" height="8" rx="1.5"/>
    <rect x="52" y="14" width="6" height="8" rx="1.5"/>
    <rect x="64" y="14" width="6" height="8" rx="1.5"/>
  </g>
</mask>
<rect width="100" height="100" fill="#fff4e6" mask="url(#${id})"/>`;

const polar = (x, y, radius, cssDeg) => {
  const theta = ((cssDeg - 90) * Math.PI) / 180;
  return [x + radius * Math.cos(theta), y + radius * Math.sin(theta)];
};

/** Pie slice. CSS conic angles: 0° is up, clockwise. resvg does not paint conic-gradient. */
const wedge = (x, y, radius, start, end) => {
  const [x0, y0] = polar(x, y, radius, start);
  const [x1, y1] = polar(x, y, radius, end);
  const large = end - start > 180 ? 1 : 0;
  return `M ${x} ${y} L ${x0} ${y0} A ${radius} ${radius} 0 ${large} 1 ${x1} ${y1} Z`;
};

/**
 * Eight iris blades. The conic pivot sits at 57% / 46% of the 560px disc
 * (same as the loader), clipped later to the ring around the true center.
 */
const bladeMarkup = (cx, cy) => {
  const pivotX = cx + 39.2;
  const pivotY = cy - 22.4;
  let markup = "";
  for (let index = 0; index < 8; index += 1) {
    const start = 8 + index * 45;
    markup += `<path d="${wedge(pivotX, pivotY, 480, start, start + 44.2)}" fill="#1b2128"/>`;
    markup += `<path d="${wedge(pivotX, pivotY, 480, start + 44.2, start + 45)}" fill="rgb(255 179 90)" fill-opacity="0.7"/>`;
  }
  return markup;
};

/** Frame 0 at CSS pixel size. Same anchors as the loader: center 50% / 43%. */
const frameSvg = (width, height) => {
  const cx = width / 2;
  const cy = height * 0.43;
  const logo = 104;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <filter id="ghostBlur" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="0.7"/>
    </filter>
    <filter id="markShadow" x="-50%" y="-50%" width="200%" height="200%">
      <feDropShadow dx="0" dy="4" stdDeviation="7" flood-color="rgb(30 0 20)" flood-opacity="0.55"/>
      <feDropShadow dx="0" dy="0" stdDeviation="9" flood-color="rgb(255 200 150)" flood-opacity="0.35"/>
    </filter>
    <filter id="posterBlur" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="2.5"/>
    </filter>
    <filter id="streakBlur">
      <feGaussianBlur stdDeviation="1.25"/>
    </filter>
    <filter id="leakBlur" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="30"/>
    </filter>
    <radialGradient id="bloom" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="rgb(255 140 80)" stop-opacity="0.2"/>
      <stop offset="1" stop-color="rgb(255 140 80)" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="leak" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="rgb(255 150 70)" stop-opacity="0.55"/>
      <stop offset="0.45" stop-color="rgb(196 35 127)" stop-opacity="0.28"/>
      <stop offset="0.7" stop-color="rgb(196 35 127)" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="grade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#24161a"/>
      <stop offset="0.4" stop-color="#1a1116"/>
      <stop offset="1" stop-color="#120d11"/>
    </linearGradient>
    <radialGradient id="amberWash" cx="26%" cy="30%" r="40%">
      <stop offset="0" stop-color="rgb(255 150 70)" stop-opacity="0.42"/>
      <stop offset="0.7" stop-color="rgb(255 150 70)" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="magentaWash" cx="72%" cy="56%" r="45%">
      <stop offset="0" stop-color="rgb(196 35 127)" stop-opacity="0.45"/>
      <stop offset="0.7" stop-color="rgb(196 35 127)" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="poster" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="rgb(255 196 140)" stop-opacity="0.75"/>
      <stop offset="0.45" stop-color="rgb(214 70 110)" stop-opacity="0.45"/>
      <stop offset="1" stop-color="rgb(60 14 40)" stop-opacity="0.6"/>
    </linearGradient>
    <linearGradient id="streak" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="rgb(255 214 170)" stop-opacity="0"/>
      <stop offset="0.2" stop-color="rgb(255 190 120)" stop-opacity="0"/>
      <stop offset="0.5" stop-color="rgb(255 214 170)" stop-opacity="0.75"/>
      <stop offset="0.8" stop-color="rgb(255 190 120)" stop-opacity="0"/>
      <stop offset="1" stop-color="rgb(255 214 170)" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="sceneMask" cx="${cx}" cy="${cy}" r="112" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#fff"/>
      <stop offset="${96 / 112}" stop-color="#fff"/>
      <stop offset="1" stop-color="#000"/>
    </radialGradient>
    <mask id="scene">
      <rect width="${width}" height="${height}" fill="#000"/>
      <circle cx="${cx}" cy="${cy}" r="112" fill="url(#sceneMask)"/>
    </mask>
    <clipPath id="irisRing">
      <path clip-rule="evenodd" d="M ${cx + 200} ${cy} A 200 200 0 1 1 ${cx - 200} ${cy} A 200 200 0 1 1 ${cx + 200} ${cy} Z M ${cx + 109} ${cy} A 109 109 0 1 0 ${cx - 109} ${cy} A 109 109 0 1 0 ${cx + 109} ${cy} Z"/>
    </clipPath>
    <radialGradient id="vig" cx="50%" cy="46%" r="62%" gradientUnits="objectBoundingBox">
      <stop offset="0.45" stop-color="rgb(14 17 20)" stop-opacity="0"/>
      <stop offset="0.78" stop-color="rgb(14 17 20)" stop-opacity="0.65"/>
      <stop offset="1" stop-color="${LAUNCH}"/>
    </radialGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="${LAUNCH}"/>
  <g filter="url(#leakBlur)" opacity="0.32">
    <ellipse cx="${width + 40}" cy="20" rx="260" ry="260" fill="url(#leak)"/>
  </g>
  <circle cx="${cx}" cy="${cy}" r="230" fill="url(#bloom)"/>
  <g mask="url(#scene)">
    <rect width="${width}" height="${height}" fill="url(#grade)"/>
    <rect width="${width}" height="${height}" fill="url(#amberWash)"/>
    <rect width="${width}" height="${height}" fill="url(#magentaWash)"/>
    <g opacity="0.55" filter="url(#posterBlur)">
      <rect x="${cx - 85 - 18}" y="${cy - 128 + 10}" width="166" height="251" rx="16" fill="rgb(255 170 110)" opacity="0.12"/>
      <rect x="${cx - 85 + 20}" y="${cy - 128 - 8}" width="162" height="247" rx="16" fill="rgb(196 35 127)" opacity="0.14"/>
      <rect x="${cx - 85}" y="${cy - 128}" width="170" height="255" rx="16" fill="url(#poster)"/>
    </g>
    <rect x="-40" y="${cy - 2}" width="${width + 80}" height="4" fill="url(#streak)" filter="url(#streakBlur)" opacity="0.75"/>
  </g>
  <g clip-path="url(#irisRing)">
    ${bladeMarkup(cx, cy)}
  </g>
  <g opacity="0.28" transform="translate(6 -3)" filter="url(#ghostBlur)">
    <svg x="${cx - logo / 2}" y="${cy - logo / 2}" width="${logo}" height="${logo}" viewBox="0 0 100 100">
      ${mark("ghostMark")}
    </svg>
  </g>
  <g filter="url(#markShadow)">
    <svg x="${cx - logo / 2}" y="${cy - logo / 2}" width="${logo}" height="${logo}" viewBox="0 0 100 100">
      ${mark("logoMark")}
    </svg>
  </g>
  <circle cx="${cx}" cy="${cy}" r="109" fill="none" stroke="rgb(255 190 110)" stroke-opacity="0.38" stroke-width="6"/>
  <rect width="${width}" height="${height}" fill="url(#vig)"/>
  <text x="${cx}" y="${cy + 193.64}" text-anchor="middle" dominant-baseline="hanging"
    font-family="Fraunces" font-size="42" font-weight="540" fill="#f3ede4" letter-spacing="-0.42">Filmia</text>
  <text x="${cx}" y="${cy + 257.64}" text-anchor="middle" dominant-baseline="hanging"
    font-family="Geist" font-size="12" font-weight="600" fill="#ffb35a" letter-spacing="4.08">PREPARANDO LA FUNCIÓN</text>
</svg>`;
};

const ensureFont = async (file, url) => {
  const destination = path.join(fontDir, file);
  try {
    await readFile(destination);
    return destination;
  } catch {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Could not download ${url} (${response.status})`);
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    await mkdir(fontDir, { recursive: true });
    await writeFile(destination, bytes);
    return destination;
  }
};

const renderPng = async (cssWidth, cssHeight, ratio, fontFiles) => {
  const physicalW = cssWidth * ratio;
  const physicalH = cssHeight * ratio;
  const resvg = new Resvg(frameSvg(cssWidth, cssHeight), {
    fitTo: { mode: "width", value: physicalW },
    background: LAUNCH,
    font: {
      fontFiles,
      loadSystemFonts: false,
      defaultFontFamily: "Fraunces",
    },
  });
  const rendered = resvg.render();
  let pipeline = sharp(rendered.asPng());
  if (rendered.width !== physicalW || rendered.height !== physicalH) {
    pipeline = pipeline.resize(physicalW, physicalH, { fit: "fill" });
  }
  return pipeline.png({ compressionLevel: 9, palette: true, quality: 85, effort: 10 }).toBuffer();
};

const fonts = await Promise.all([
  ensureFont("fraunces.ttf", FRAUNCES_URL),
  ensureFont("geist-semibold.ttf", GEIST_URL),
]);

const devices = JSON.parse(await readFile(devicesPath, "utf8"));
await mkdir(outDir, { recursive: true });

const only = process.argv[2];

for (const device of devices) {
  if (only && !`${device.width}x${device.height}`.startsWith(only) && !device.name.includes(only)) {
    continue;
  }
  const png = await renderPng(device.width, device.height, device.ratio, fonts);
  const file = `apple-splash-${device.width * device.ratio}x${device.height * device.ratio}.png`;
  await writeFile(path.join(outDir, file), png);
  console.log(`wrote public/splash/${file} (${device.name})`);
}
