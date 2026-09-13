import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AMBIENT_FALLBACK_RGB,
  clampByte,
  formatAmbientRgb,
  normalizePosterAmbientPath,
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

  it("skips dead gray mid-tones on vivid pass then averages soft gray last-resort", () => {
    const grays = makeImageData([
      [118, 121, 120, 255],
      [130, 128, 129, 255],
      [110, 112, 111, 255],
    ]);
    const rgb = sampleAmbientFromImageData(grays);
    // Last-resort average of near-gray is OK; softenAmbientRgb maps to indigo.
    assert.ok(rgb.r >= 100 && rgb.r <= 140);
    assert.ok(rgb.g >= 100 && rgb.g <= 140);
    assert.ok(rgb.b >= 100 && rgb.b <= 140);
    assert.deepEqual(softenAmbientRgb(rgb), AMBIENT_FALLBACK_RGB);
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

  it("boosts saturation/luma without leaving the byte range", () => {
    const soft = softenAmbientRgb({ r: 200, g: 40, b: 40 });
    assert.ok(soft.r >= 200 && soft.r <= 255);
    assert.ok(soft.g >= 0 && soft.g <= 80);
    assert.ok(soft.b >= 0 && soft.b <= 80);
    const beforeSat = (200 - 40) / 200;
    const afterSat =
      (Math.max(soft.r, soft.g, soft.b) - Math.min(soft.r, soft.g, soft.b)) /
      Math.max(soft.r, soft.g, soft.b);
    assert.ok(afterSat >= beforeSat * 0.9);
  });

  it("maps near-gray samples to cinematic fallback", () => {
    const soft = softenAmbientRgb({ r: 118, g: 121, b: 120 });
    assert.deepEqual(soft, AMBIENT_FALLBACK_RGB);
  });

  it("keeps teal identity for Interstellar-like samples", () => {
    const soft = softenAmbientRgb({ r: 40, g: 140, b: 160 });
    assert.ok(soft.g > soft.r, "teal should stay green-forward");
    assert.ok(soft.b > soft.r, "teal should stay blue-forward");
    assert.notDeepEqual(soft, AMBIENT_FALLBACK_RGB);
  });

  it("normalizes poster ambient paths", () => {
    assert.equal(normalizePosterAmbientPath("/abc.jpg"), "/abc.jpg");
    assert.equal(normalizePosterAmbientPath("abc.jpg"), "/abc.jpg");
    assert.equal(
      normalizePosterAmbientPath("https://image.tmdb.org/t/p/w185/abc.jpg"),
      "/abc.jpg",
    );
    assert.equal(normalizePosterAmbientPath("/posters/x.png"), "/posters/x.png");
    assert.equal(normalizePosterAmbientPath(null), null);
  });
});
