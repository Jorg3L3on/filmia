import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clampCoverflowIndex,
  COVERFLOW_CARD_WIDTH,
  COVERFLOW_CARD_WIDTH_MAX_WIDE,
  COVERFLOW_CARD_WIDTH_MIN,
  getCoverflowCardMetrics,
  measureCoverflowCardWidth,
  paintCoverflowCard,
  stepCoverflowSpring,
} from "./coverflow-metrics";
import { asomoAt } from "./coverflow-projection";

describe("coverflow metrics", () => {
  it("clamps the focused index to the deck", () => {
    assert.equal(clampCoverflowIndex(-2, 4), 0);
    assert.equal(clampCoverflowIndex(9, 4), 4);
    assert.equal(clampCoverflowIndex(2, 4), 2);
    assert.equal(clampCoverflowIndex(0, -1), 0);
  });

  it("marks the center card as active and dims far cards", () => {
    const center = getCoverflowCardMetrics(0, 120);
    const side = getCoverflowCardMetrics(2, 120);
    assert.equal(center.isActive, true);
    assert.equal(side.isActive, false);
    assert.ok(center.scale > side.scale);
    assert.ok(center.opacity >= side.opacity);
    assert.ok(center.brightness > side.brightness);
  });

  it("soft-coverflow fans left and right with blur + depth", () => {
    const center = getCoverflowCardMetrics(0, 160, false, true);
    const left = getCoverflowCardMetrics(-1.2, 160, false, true);
    const right = getCoverflowCardMetrics(1.2, 160, false, true);
    const farRight = getCoverflowCardMetrics(2.4, 160, false, true);

    assert.equal(center.isActive, true);
    assert.equal(center.blur, 0);
    assert.ok(Math.abs(center.rotateY) < 1e-9);

    // True L+R fan: opposite rotateY toward center, both scaled/dimmed/blurred.
    assert.ok(left.rotateY > 0);
    assert.ok(right.rotateY < 0);
    assert.ok(Math.abs(left.rotateY + right.rotateY) < 0.001);
    assert.ok(left.translateX < 0);
    assert.ok(right.translateX > 0);
    assert.ok(left.translateZ < 0);
    assert.ok(right.translateZ < 0);
    // Asomo (FIL-I21-4): the ±1 neighbours peek unblurred; ±2 keeps its blur.
    assert.equal(left.blur, 0);
    assert.equal(right.blur, 0);
    assert.ok(farRight.blur > 0);
    assert.ok(center.scale > right.scale);
    assert.ok(center.brightness > right.brightness);

    // Even at index=0 (only positive offsets), neighbors still fan — not a flat stack.
    const edgeNeighbor = getCoverflowCardMetrics(1, 160, false, true);
    assert.ok(edgeNeighbor.translateX > 40);
    assert.ok(Math.abs(edgeNeighbor.rotateY) > 28);
    assert.ok(edgeNeighbor.translateZ < -70);
    assert.ok(center.scale - right.scale > 0.12);
    assert.equal(edgeNeighbor.blur, 0);
  });

  it("fits card width between the page min and max", () => {
    assert.equal(measureCoverflowCardWidth(1400, false, 700), COVERFLOW_CARD_WIDTH_MAX_WIDE);
    assert.equal(measureCoverflowCardWidth(850, false, 560), COVERFLOW_CARD_WIDTH);
    assert.ok(measureCoverflowCardWidth(200, false) >= COVERFLOW_CARD_WIDTH_MIN);
    assert.ok(measureCoverflowCardWidth(200, true) <= 156);
  });

  it("shrinks page cards when stage height is tight", () => {
    const wideButShort = measureCoverflowCardWidth(900, false, 240);
    assert.ok(wideButShort < COVERFLOW_CARD_WIDTH);
    assert.ok(wideButShort >= COVERFLOW_CARD_WIDTH_MIN);
  });

  it("grows cinematic hero while leaving room for the L+R fan", () => {
    const phone = measureCoverflowCardWidth(358, false, 400, true);
    assert.ok(phone >= 190, `phone hero too small: ${phone}`);
    assert.ok(phone <= Math.round(358 * 0.62));

    const cinematic = measureCoverflowCardWidth(1000, false, 560, true);
    assert.ok(cinematic >= 300, `desktop hero too small: ${cinematic}`);
    assert.ok(cinematic < 1000 * 0.45);
  });

  it("keeps soft-coverflow center unblurred while sides stay softer than before", () => {
    const center = getCoverflowCardMetrics(0, 160, false, true);
    const side = getCoverflowCardMetrics(2, 160, false, true);
    const far = getCoverflowCardMetrics(3, 160, false, true);
    assert.equal(center.blur, 0);
    assert.ok(side.blur > 0);
    assert.ok(side.blur <= 5.2);
    assert.ok(far.blur <= 5.2);
    assert.ok(far.blur >= side.blur);
  });


  it("asomo: on the phone the neighbours peek ~40 px, ±2 hides behind ±1, air stays at the edge (FIL-I21-4)", () => {
    // Measured in Chrome at 390×844 with the pinned numbers: peek 41.2 px, air 26.5 px (the
    // projection below gives 41.5 / 26.5). 375×812: 39.2 / 25.8; 359: 37.1 / 24.9; 375×667: 53.6 / 21.9.
    for (const [stageWidth, stageHeight, minPeek] of [
      [358, 400, 41],
      [343, 400, 39],
      [343, 292, 50],
      [327, 400, 37],
    ] as const) {
      const hero = measureCoverflowCardWidth(stageWidth, false, stageHeight, true);
      const { peek, air, secondBehind, heroEdge } = asomoAt(stageWidth, hero);
      assert.ok(peek >= minPeek, `peek at ${stageWidth}: ${peek.toFixed(1)}`);
      assert.ok(air >= 20, `air at ${stageWidth}: ${air.toFixed(1)}`);
      assert.ok(secondBehind > 0, `±2 shows past ±1 at ${stageWidth}`);
      assert.ok(Math.abs(heroEdge * 2 - hero) < 0.01, "the hero does not change");
    }
    const neighbour = getCoverflowCardMetrics(1, 66, false, true);
    assert.ok(Math.abs(neighbour.scale - 0.86) < 1e-9);
    assert.ok(Math.abs(neighbour.rotateY + 32) < 1e-9);
    assert.ok(Math.abs(neighbour.brightness - 0.7) < 1e-9);
    assert.equal(neighbour.blur, 0);
    // Wider stages (desktop) keep the old ×1.28 fan.
    const wide = getCoverflowCardMetrics(1, 300, false, true);
    assert.ok(Math.abs(wide.translateX - 300 * (1 - Math.exp(-1.12)) * 1.28) < 1e-6);
  });

  it("paints lite neighbours without rotation and the ±1 face without blur (FIL-I21-4)", () => {
    const fakeNode = () => {
      const style: Record<string, string> = {};
      const classes = new Set<string>();
      const attrs: Record<string, string> = {};
      return {
        style,
        classList: { contains: (c: string) => classes.has(c), toggle: (c: string, on: boolean) => (on ? classes.add(c) : classes.delete(c)) },
        getAttribute: (name: string) => attrs[name] ?? null,
        setAttribute: (name: string, value: string) => { attrs[name] = value; },
      } as unknown as HTMLElement;
    };
    const paint = (lite: boolean) => {
      const node = { root: fakeNode(), face: fakeNode(), dim: fakeNode(), caption: null, link: null };
      paintCoverflowCard(node, 1, 66, false, false, true, lite);
      return { transform: node.root.style.transform, filter: node.face!.style.filter };
    };
    const full = paint(false);
    const lite = paint(true);
    assert.ok(full.transform.includes("rotateY(-32.00deg)"), full.transform);
    assert.ok(lite.transform.includes("rotateY(0.00deg)"), lite.transform);
    assert.ok(lite.transform.includes("scale(0.8600)"));
    assert.equal(full.filter, "none");
    assert.equal(lite.filter, "none");
  });

  it("settles the spring in the same time at 60 Hz and 120 Hz", () => {
    const run = (hz: number, seconds: number) => {
      let state = { offset: 1, velocity: 0 };
      for (let i = 0; i < Math.round(seconds * hz); i += 1) {
        state = stepCoverflowSpring(state.offset, state.velocity, 1 / hz);
      }
      return state;
    };
    const at60 = run(60, 0.15);
    const at120 = run(120, 0.15);
    assert.ok(Math.abs(at60.offset - at120.offset) < 1e-9);
    assert.ok(at60.offset > 0 && at60.offset < 1);
    // At rest after half a second, without overshooting past the target.
    assert.ok(Math.abs(run(60, 0.5).offset) < 0.01);
    assert.ok(run(120, 0.5).offset >= 0);
  });

  it("eases into the spring instead of starting at full speed", () => {
    const first = stepCoverflowSpring(1, 0, 1 / 60);
    const second = stepCoverflowSpring(first.offset, first.velocity, 1 / 60);
    assert.ok(1 - first.offset < first.offset - second.offset);
  });
});
