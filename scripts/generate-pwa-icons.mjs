/**
 * Build the favicons, Apple touch icon and PWA icons from the two brand SVGs:
 *   public/filmia-icon.svg  full-bleed gradient tile with the white F (home screen)
 *   public/filmia-mark.svg  the gradient F on transparent (browser tab, in-app logo)
 * The SVGs are the supplied artwork; this script only rasterises them.
 *
 *   npm run generate:pwa-icons
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ICON = path.join(root, "public", "filmia-icon.svg");
const MARK = path.join(root, "public", "filmia-mark.svg");

/**
 * The tile is full bleed, so iOS and Android apply their own corner mask. The F
 * already sits inside the maskable 80% safe-zone circle, so the maskable icon is
 * the same render.
 */
const OUTPUTS = [
  { file: "public/apple-touch-icon.png", source: ICON, size: 180 },
  { file: "public/icon-192.png", source: ICON, size: 192 },
  { file: "public/icon-512.png", source: ICON, size: 512 },
  { file: "public/icon-512-maskable.png", source: ICON, size: 512 },
  { file: "public/filmia-mark.png", source: MARK, size: 512 },
  { file: "src/app/icon.png", source: MARK, size: 512 },
];

/** Sizes packed into src/app/favicon.ico. */
const FAVICON_SIZES = [16, 32, 48];

const render = async (source, size, { opaque = false } = {}) => {
  const svg = await readFile(source);
  // Rasterise at a density that lands exactly on `size`, so resize never upscales.
  const { width } = await sharp(svg).metadata();
  let image = sharp(svg, { density: (72 * size) / width }).resize(size, size);
  if (opaque) image = image.removeAlpha();
  return image.png({ compressionLevel: 9 }).toBuffer();
};

/** ICO container holding PNG entries (supported by every current browser). */
const toIco = (pngs) => {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);

  let offset = 6 + 16 * pngs.length;
  const entries = pngs.map(({ size, data }) => {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += data.length;
    return entry;
  });

  return Buffer.concat([header, ...entries, ...pngs.map(({ data }) => data)]);
};

const write = async (file, data) => {
  const destination = path.join(root, file);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, data);
  console.log(`wrote ${file}`);
};

for (const output of OUTPUTS) {
  await write(output.file, await render(output.source, output.size, { opaque: output.source === ICON }));
}

const favicons = await Promise.all(
  FAVICON_SIZES.map(async (size) => ({ size, data: await render(MARK, size) })),
);
await write("src/app/favicon.ico", toIco(favicons));
