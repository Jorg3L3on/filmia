import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AMBIENT_FALLBACK_RGB,
  clampByte,
  formatAmbientRgb,
  sampleAmbientFromImageData,
  softenAmbientRgb,
} from "./poster-ambient";

const makeImageData = (pixels: Array<[number, number, number, number]>) => {
  const data = new Uint8ClampedArray(pixels.length * 4);
  pixels.forEach((pixel, index) => {
    data.set(pixel, index * 4);
  });
  return { data, width: pixels.length, height: 1 } as ImageData;
};

describe("poster ambient", () => {
  it("formats and clamps rgb channels", () => {
    assert.equal(formatAmbientRgb({ r: -4, g: 300, b: 12.4 }), "0 255 12");
    assert.equal(clampByte(12.6), 13);
  });

  it("falls back when pixels are empty or too dark/bright", () => {
    const empty = makeImageData([]);
    assert.deepEqual(sampleAmbientFromImageData(empty), AMBIENT_FALLBACK_RGB);

    const blacks = makeImageData([
      [0, 0, 0, 255],
      [255, 255, 255, 255],
      [10, 10, 10, 100],
    ]);
    assert.deepEqual(sampleAmbientFromImageData(blacks), AMBIENT_FALLBACK_RGB);
  });

  it("averages saturated mid-tones", () => {
    const sample = makeImageData([
      [40, 80, 180, 255],
      [50, 90, 190, 255],
      [0, 0, 0, 255],
    ]);
    const rgb = sampleAmbientFromImageData(sample);
    assert.equal(rgb.r, 45);
    assert.equal(rgb.g, 85);
    assert.equal(rgb.b, 185);
  });

  it("softens ambient without leaving the byte range", () => {
    const soft = softenAmbientRgb({ r: 200, g: 40, b: 40 });
    assert.ok(soft.r >= 200 && soft.r <= 255);
    assert.ok(soft.g >= 40);
    assert.ok(soft.b >= 40);
  });
});
