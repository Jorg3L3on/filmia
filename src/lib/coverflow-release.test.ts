import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clampCoverflowIndex,
  COVERFLOW_COAST_FRICTION,
  COVERFLOW_COAST_MIN_VELOCITY,
  COVERFLOW_SPRING_REST_OFFSET,
  COVERFLOW_SPRING_REST_VELOCITY,
  coverflowTransform,
  getCoverflowCardMetrics,
  stepCoverflowSpring,
} from "./coverflow-metrics";
import { planRelease, releaseIndexAt, releaseKeyframes, releaseStateKey } from "./coverflow-release";

/** The engine's rAF loop at exactly 60 Hz, written out again here as the reference. */
const referenceTrajectory = (display: number, velocity: number, ceiling: number, settleTarget: number, coasting: boolean) => {
  const out = [display];
  let mode = coasting ? "coast" : "spring";
  let target = settleTarget;
  let springVelocity = 0;
  for (let i = 0; i < 240; i += 1) {
    if (mode === "coast") {
      display = clampCoverflowIndex(display + velocity, ceiling);
      velocity *= COVERFLOW_COAST_FRICTION;
      const atEdge = (display <= 0 && velocity < 0) || (display >= ceiling && velocity > 0);
      if (atEdge || Math.abs(velocity) < COVERFLOW_COAST_MIN_VELOCITY) {
        target = clampCoverflowIndex(Math.round(display), ceiling);
        springVelocity = atEdge ? 0 : velocity * 60;
        velocity = 0;
        mode = "spring";
      }
    } else {
      const gap = display - target;
      if (Math.abs(gap) < COVERFLOW_SPRING_REST_OFFSET && Math.abs(springVelocity) < COVERFLOW_SPRING_REST_VELOCITY) {
        out.push(target);
        return out;
      }
      const next = stepCoverflowSpring(gap, springVelocity, 1 / 60);
      display = clampCoverflowIndex(target + next.offset, ceiling);
      springVelocity = next.velocity;
    }
    out.push(display);
  }
  return out;
};

const pxAt = (cardIndex: number, deckIndex: number) =>
  getCoverflowCardMetrics(cardIndex - deckIndex, 66, false, true).translateX;

describe("coverflow release", () => {
  it("samples a fling and its settle within 0.5 px of the engine's own steps", () => {
    for (const [display, velocity] of [[3.2, 0.35], [6.8, -0.22], [1.4, 0.08], [9.1, 0.5]] as const) {
      const plan = planRelease({ display, velocity, springVelocity: 0, ceiling: 20, settleTarget: Math.round(display), coasting: true });
      const reference = referenceTrajectory(display, velocity, 20, Math.round(display), true);
      assert.equal(plan.samples.length, reference.length);
      plan.samples.forEach((sample, i) => {
        for (const card of [0, 5, 10, 15]) {
          assert.ok(Math.abs(pxAt(card, sample.index) - pxAt(card, reference[i]!)) < 0.5, `sample ${i} card ${card}`);
        }
      });
      assert.equal(plan.restIndex, plan.samples[plan.samples.length - 1]!.index);
      assert.ok(Number.isInteger(plan.restIndex));
    }
  });

  it("settles a plain release with the spring and rests on the target card", () => {
    const plan = planRelease({ display: 4.3, velocity: 0, springVelocity: 1.5, ceiling: 20, settleTarget: 4, coasting: false });
    const reference = referenceTrajectory(4.3, 0, 20, 4, false);
    assert.ok(Math.abs(plan.samples.length - reference.length) <= 1);
    assert.equal(plan.restIndex, 4);
    assert.ok(plan.durationMs > 100 && plan.durationMs < 1200);
  });

  it("stops at the first and last card without overshoot", () => {
    const end = planRelease({ display: 18.5, velocity: 0.6, springVelocity: 0, ceiling: 20, settleTarget: 19, coasting: true });
    assert.equal(end.restIndex, 20);
    assert.ok(end.samples.every((s) => s.index <= 20));
    const start = planRelease({ display: 1.2, velocity: -0.6, springVelocity: 0, ceiling: 20, settleTarget: 1, coasting: true });
    assert.equal(start.restIndex, 0);
    assert.ok(start.samples.every((s) => s.index >= 0));
  });

  it("reads where the deck is at any time, linear between samples", () => {
    const plan = planRelease({ display: 2, velocity: 0.3, springVelocity: 0, ceiling: 20, settleTarget: 2, coasting: true });
    assert.equal(releaseIndexAt(plan, 0), 2);
    assert.equal(releaseIndexAt(plan, plan.durationMs + 500), plan.restIndex);
    const mid = releaseIndexAt(plan, (plan.samples[3]!.t + plan.samples[4]!.t) / 2);
    assert.ok(Math.abs(mid - (plan.samples[3]!.index + plan.samples[4]!.index) / 2) < 1e-9);
  });

  it("builds keyframes from the same metrics the engine paints with", () => {
    const plan = planRelease({ display: 3.4, velocity: 0.2, springVelocity: 0, ceiling: 20, settleTarget: 3, coasting: true });
    const frames = releaseKeyframes(plan, 5, 66, false, true)!;
    assert.ok(frames.mover.length >= plan.samples.length / 2 && frames.mover.length <= plan.samples.length);
    assert.equal(frames.mover[0]!.offset, 0);
    assert.equal(frames.mover[frames.mover.length - 1]!.offset, 1);
    const first = getCoverflowCardMetrics(5 - 3.4, 66, false, true);
    assert.equal(frames.mover[0]!.transform, coverflowTransform(first, false));
    assert.equal(frames.dim[0]!.opacity, (1 - first.brightness).toFixed(2));
  });

  it("skips a card that is culled the whole way and keeps the last sample exact", () => {
    const plan = planRelease({ display: 3.4, velocity: 0.2, springVelocity: 0, ceiling: 40, settleTarget: 3, coasting: true });
    assert.equal(releaseKeyframes(plan, 30, 66, false, true), null);
    assert.notEqual(releaseKeyframes(plan, 30, 300, false, true), null);
    const frames = releaseKeyframes(plan, 5, 66, false, true)!;
    const rest = getCoverflowCardMetrics(5 - plan.restIndex, 66, false, true);
    assert.equal(frames.mover[frames.mover.length - 1]!.transform, coverflowTransform(rest, false));
  });

  it("changes the discrete state only when the focused card or order changes", () => {
    assert.equal(releaseStateKey(3.0), releaseStateKey(3.2));
    assert.notEqual(releaseStateKey(3.2), releaseStateKey(3.5));
    assert.notEqual(releaseStateKey(3.4), releaseStateKey(3.6));
  });
});
