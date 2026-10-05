import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ACCENT_RGB, auraBloomImage, hexToRgbChannels, platformGlowRgb } from "./aura";

describe("aura bloom", () => {
  it("converts hex to rgb channels", () => {
    assert.equal(hexToRgbChannels("#e50914"), "229 9 20");
    assert.equal(hexToRgbChannels("#fff"), "255 255 255");
  });

  it("uses the platform hue, falling back to the accent", () => {
    assert.equal(platformGlowRgb("NETFLIX"), "229 9 20");
    assert.equal(platformGlowRgb("APPLE"), ACCENT_RGB);
    assert.equal(platformGlowRgb(null), ACCENT_RGB);
  });

  it("scales both washes by strength", () => {
    const full = auraBloomImage("1 2 3");
    assert.match(full, /rgb\(1 2 3 \/ 0\.2\)/);
    assert.match(full, /rgb\(1 2 3 \/ 0\.08\)/);
    assert.match(auraBloomImage("1 2 3", 0.5), /rgb\(1 2 3 \/ 0\.1\)/);
  });
});
