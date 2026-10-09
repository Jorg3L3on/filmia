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
    const janky = [...Array(24).fill(45), ...Array(24).fill(16.7), ...Array(24).fill(45)];
    assert.equal(feed(monitor, janky), false);
  });

  it("goes lite after two slow windows in a row", () => {
    const monitor = createFramePaceMonitor();
    assert.equal(feed(monitor, Array(47).fill(33)), false);
    assert.equal(monitor.push(33), true);
  });

  it("judges by the median, so a few long frames don't count", () => {
    const monitor = createFramePaceMonitor();
    const mostlyFine = Array.from({ length: 96 }, (_, i) => (i % 6 === 0 ? 80 : 16.7));
    assert.equal(feed(monitor, mostlyFine), false);
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
