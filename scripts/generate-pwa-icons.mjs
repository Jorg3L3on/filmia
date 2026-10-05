/**
 * Build the Apple touch icon and PWA icons from public/filmia-mark.png.
 * Same treatment as MiCasa / ZigZag: the mark is the supplied artwork, this
 * script only trims, scales and plates it on a near-black square.
 *
 *   npm run generate:pwa-icons
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "public", "filmia-mark.png");

/** globals.css --canvas-deep. Near-black like the sibling apps' icon plates. */
const PLATE = { r: 0x09, g: 0x0b, b: 0x0d, alpha: 1 };

/** Mark height as a fraction of the tile. Matches the optical size of the M / Z marks. */
const MARK_RATIO = 0.58;
/** Android maskable: keep the mark inside the 80% safe-zone circle. */
const MASKABLE_RATIO = 0.48;

const OUTPUTS = [
  { file: "public/apple-touch-icon.png", size: 180 },
  { file: "public/icon-192.png", size: 192 },
  { file: "public/icon-512.png", size: 512 },
  { file: "public/icon-512-maskable.png", size: 512, maskable: true },
];

/** Bounding box of visible pixels, so the scale is set by the F itself, not the PNG's padding. */
const contentBox = async (file) => {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let left = info.width, top = info.height, right = -1, bottom = -1;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * 4 + 3] > 8) {
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
  }
  return { left, top, width: right - left + 1, height: bottom - top + 1 };
};

const renderIcon = async (box, size, { maskable = false } = {}) => {
  const target = Math.round(size * (maskable ? MASKABLE_RATIO : MARK_RATIO));
  const mark = await sharp(source)
    .extract(box)
    .resize({ width: target, height: target, fit: "inside", kernel: "lanczos3" })
    .png()
    .toBuffer();
  const meta = await sharp(mark).metadata();

  return sharp({ create: { width: size, height: size, channels: 4, background: PLATE } })
    .composite([
      {
        input: mark,
        left: Math.round((size - meta.width) / 2),
        top: Math.round((size - meta.height) / 2),
      },
    ])
    .removeAlpha()
    .png({ compressionLevel: 9 })
    .toBuffer();
};

const box = await contentBox(source);
for (const output of OUTPUTS) {
  const png = await renderIcon(box, output.size, output);
  const destination = path.join(root, output.file);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, png);
  console.log(`wrote ${output.file}`);
}
