import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createFramePaceMonitor, isLowEndDevice } from "./deck-lite";

const feed = (monitor: ReturnType<typeof createFramePaceMonitor>, frames: number[]) =>
  frames.some((frame) => monitor.push(frame));

describe("deck lite", () => {
  it("stays full on a phone holding 60 or 120 Hz", () => {
    const monitor = createFramePaceMonitor();
    assert.equal(feed(monitor, Array(200).fill(16.7)), false);
    assert.equal(feed(monitor, Array(200).fill(8.3)), false);
  });

  it("ignores one janky window (image decode, hydration)", () => {
    const monitor = createFramePaceMonitor();
    const janky = [...Array(40).fill(45), ...Array(40).fill(16.7), ...Array(40).fill(45)];
    assert.equal(feed(monitor, janky), false);
  });

  it("goes lite after two slow windows in a row", () => {
    const monitor = createFramePaceMonitor();
    assert.equal(feed(monitor, Array(79).fill(33)), false);
    assert.equal(monitor.push(33), true);
  });

  it("trips on a steady 5 % of long frames even with a perfect median", () => {
    const monitor = createFramePaceMonitor();
    const stalls = Array.from({ length: 200 }, (_, i) => (i % 20 === 0 ? 60 : 16.7));
    assert.equal(feed(monitor, stalls), true);
  });

  it("does not trip on a single long frame, a clean run or an odd stall now and then", () => {
    assert.equal(feed(createFramePaceMonitor(), [16.7, 16.7, 90, ...Array(200).fill(16.7)]), false);
    assert.equal(feed(createFramePaceMonitor(), Array(400).fill(16.7)), false);
    const rare = Array.from({ length: 400 }, (_, i) => (i % 60 === 0 ? 70 : 16.7));
    assert.equal(feed(createFramePaceMonitor(), rare), false);
  });

  it("skips paused or bogus frames", () => {
    const monitor = createFramePaceMonitor();
    assert.equal(feed(monitor, [...Array(60).fill(1000), ...Array(60).fill(0), NaN]), false);
  });

  it("flags only clearly low-end hints", () => {
    assert.equal(isLowEndDevice({ deviceMemory: 2 }), true);
    assert.equal(isLowEndDevice({ hardwareConcurrency: 2 }), true);
    assert.equal(isLowEndDevice({ deviceMemory: 4, hardwareConcurrency: 4 }), false);
    assert.equal(isLowEndDevice({}), false);
  });
});
