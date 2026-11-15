import zlib from "node:zlib";
// Minimal PNG decoder (8-bit RGB/RGBA, non-interlaced): enough for Chrome screenshots.
export const decodePng = (buf) => {
  let pos = 8, width = 0, height = 0, colorType = 6;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos); const type = buf.toString("ascii", pos + 4, pos + 8); const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") { width = data.readUInt32BE(0); height = data.readUInt32BE(4); colorType = data[9]; }
    if (type === "IDAT") idat.push(data);
    pos += 12 + len;
  }
  const bpp = colorType === 6 ? 4 : 3;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * bpp;
  const out = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const v = raw[y * (stride + 1) + 1 + x];
      const a = x >= bpp ? out[y * stride + x - bpp] : 0;
      const b = y > 0 ? out[(y - 1) * stride + x] : 0;
      const c = x >= bpp && y > 0 ? out[(y - 1) * stride + x - bpp] : 0;
      let p = 0;
      if (f === 1) p = a; else if (f === 2) p = b; else if (f === 3) p = (a + b) >> 1;
      else if (f === 4) { const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c); p = pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      out[y * stride + x] = (v + p) & 255;
    }
  }
  return { width, height, bpp, data: out };
};
export const diff = (aBuf, bBuf) => {
  const a = decodePng(aBuf), b = decodePng(bBuf);
  let changed = 0, big = 0, maxDelta = 0;
  const n = a.width * a.height;
  for (let i = 0; i < n; i++) {
    const o = i * a.bpp;
    const d = Math.max(Math.abs(a.data[o] - b.data[o]), Math.abs(a.data[o + 1] - b.data[o + 1]), Math.abs(a.data[o + 2] - b.data[o + 2]));
    if (d > 0) changed++;
    if (d > 8) big++;
    if (d > maxDelta) maxDelta = d;
  }
  return { pixels: n, changed, changedPct: +((changed / n) * 100).toFixed(3), over8: big, over8Pct: +((big / n) * 100).toFixed(3), maxDelta };
};

