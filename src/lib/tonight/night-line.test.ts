import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { nightLineFor } from "./night-line";
import { fitForRuntime, remainingMinutes, parseNightEnds } from "./time";

const nightEnds = parseNightEnds(null); // 23:30 weekdays
const at = (h: number, m: number) => new Date(2026, 9, 21, h, m); // Wednesday
const line = (runtime: number | null, now: Date, kind: "MOVIE" | "SERIES" = "MOVIE", night = true) =>
  nightLineFor({
    runtimeMinutes: runtime,
    kind,
    fit: runtime ? fitForRuntime(runtime, remainingMinutes(now, nightEnds), now) : null,
    night,
    now,
  });

describe("línea de la noche (FIL-I21-5)", () => {
  it("fits: ends before bedtime", () => {
    const l = line(72, at(21, 58));
    assert.equal(l.state, "fits");
    if (l.state === "fits") {
      assert.equal(l.startsAt, "21:58");
      assert.equal(l.endsAt, "23:10");
      assert.equal(l.bedtimeAt, "23:30");
      assert.ok(Math.abs(l.endRatio - 72 / 92) < 1e-9);
      assert.equal(l.label, "Empieza 21:58 y acaba 23:10; tu hora es 23:30");
    }
  });

  it("over by up to 30 min: amber tail, «se pasa 12 min»", () => {
    const l = line(104, at(21, 58));
    assert.equal(l.state, "over");
    if (l.state === "over") {
      assert.equal(l.overflowMinutes, 12);
      assert.equal(l.endsAt, "23:42");
      assert.ok(Math.abs(l.bedtimeRatio - 92 / 104) < 1e-9);
    }
    assert.equal(line(122, at(21, 58)).state, "over");
  });

  it("over by more than 30 min: no line, the chip carries the amber warning", () => {
    const l = line(164, at(21, 58));
    assert.equal(l.state, "over-long");
    if (l.state === "over-long") {
      assert.equal(l.overflowLabel, "se pasa 1 h 12 min");
    }
  });

  it("bedtime already passed: dimmed line with «acabaría»", () => {
    const l = line(108, at(23, 48));
    assert.equal(l.state, "past");
    if (l.state === "past") {
      assert.equal(l.endsAt, "01:36");
      assert.equal(l.bedtimeAt, "23:48");
    }
  });

  it("a series measures one episode", () => {
    const l = line(42, at(21, 58), "SERIES");
    assert.equal(l.state, "fits");
    if (l.state === "fits") {
      assert.equal(l.episode, true);
      assert.ok(l.label.startsWith("Un capítulo empieza"));
    }
  });

  it("by day or without a runtime there is no line", () => {
    assert.equal(line(104, at(15, 0), "MOVIE", false).state, "none");
    assert.equal(line(null, at(21, 58)).state, "none");
    const none = line(null, at(21, 58));
    assert.equal(none.state === "none" && none.runtime, null);
  });
});
