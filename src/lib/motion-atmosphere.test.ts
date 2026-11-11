import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { alignShimmers, shouldMountAtmosphere } from "./motion-atmosphere";
import { cascadeStyle, dockStretchScale } from "./motion-style";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const MARKER = "Rediseño cinemático · A · Sistema y atmósfera (FIL-I46-1)";

describe("FIL-I46-1 motion tokens", () => {
  it("defines the cut, ambient, grain and cascade tokens in :root", () => {
    for (const token of [
      "--duration-cut: 520ms",
      "--ease-cut: cubic-bezier(0.65, 0, 0.35, 1)",
      "--duration-ambient: 12s",
      "--duration-ambient-fast: 9s",
      "--duration-ambient-slow: 16s",
      "--duration-reduced: 120ms",
      "--cascade-1: 80ms",
      "--cascade-2: 140ms",
      "--cascade-3: 220ms",
      "--cascade-step: 50ms",
      "--cascade-last: 400ms",
    ]) {
      assert.ok(css.includes(token), token);
    }
  });

  it("writes no hand-typed duration in the atmosphere rules: only tokens", () => {
    const block = css.slice(css.indexOf(MARKER));
    assert.ok(block.length > 100, "atmosphere block present");
    const timed = block
      .split("\n")
      .filter((line) => /^\s*(animation|transition|animation-delay|animation-duration)\b/.test(line));
    assert.ok(timed.length >= 8);
    for (const line of timed) {
      assert.doesNotMatch(line, /\b\d+(\.\d+)?m?s\b/, `literal duration in: ${line.trim()}`);
    }
  });

  it("animates only transform and opacity in the new keyframes (no blur)", () => {
    const block = css.slice(css.indexOf(MARKER));
    const frames = block.match(/@keyframes [\w-]+ \{[\s\S]*?\n\}/g) ?? [];
    assert.ok(frames.length >= 5);
    for (const frame of frames) {
      const props = [...frame.matchAll(/^\s+([a-z-]+):/gm)].map((m) => m[1]);
      for (const prop of props) {
        assert.ok(prop === "transform" || prop === "opacity", `${prop} in ${frame.split("\n")[0]}`);
      }
    }
  });
});

describe("shouldMountAtmosphere", () => {
  it("mounts grain and beam only with full motion outside lite", () => {
    assert.equal(shouldMountAtmosphere({ reducedMotion: false, lite: false }), true);
    assert.equal(shouldMountAtmosphere({ reducedMotion: true, lite: false }), false);
    assert.equal(shouldMountAtmosphere({ reducedMotion: false, lite: true }), false);
    assert.equal(shouldMountAtmosphere({ reducedMotion: true, lite: true }), false);
  });
});

describe("alignShimmers", () => {
  it("puts every shimmer sweep on the timeline origin and leaves other animations alone", () => {
    const shimmerA = { animationName: "shimmer", startTime: 812 };
    const shimmerB = { animationName: "shimmer", startTime: 0 };
    const other = { animationName: "fade-up", startTime: 300 };
    alignShimmers([shimmerA, shimmerB, other] as unknown as Animation[]);
    assert.equal(shimmerA.startTime, 0);
    assert.equal(shimmerB.startTime, 0);
    assert.equal(other.startTime, 300);
  });
});

describe("cascadeStyle / dockStretchScale", () => {
  it("passes the item index to the cascade (CSS caps it at 7)", () => {
    assert.equal((cascadeStyle(3) as Record<string, number>)["--cascade-i"], 3);
    assert.equal((cascadeStyle(-2) as Record<string, number>)["--cascade-i"], 0);
    assert.ok(css.includes("min(var(--cascade-i, 0), 7)"));
  });

  it("stretches more for longer jumps, never past 1.9×", () => {
    assert.equal(dockStretchScale(0), 1);
    assert.equal(dockStretchScale(1), 1.35);
    assert.ok(dockStretchScale(2) > dockStretchScale(1));
    assert.equal(dockStretchScale(9), 1.9);
  });
});
