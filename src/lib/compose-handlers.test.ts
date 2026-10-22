import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { composeHandlers } from "./compose-handlers";

type Evt = { type: string };

describe("composeHandlers", () => {
  it("calls every set's handler of the same name, in order, with the same event", () => {
    const calls: string[] = [];
    const swipe = {
      onPointerDown: (event: Evt) => calls.push(`swipe:${event.type}`),
      onPointerMove: (event: Evt) => calls.push(`swipe:${event.type}`),
      onPointerUp: (event: Evt) => calls.push(`swipe:${event.type}`),
      onPointerCancel: (event: Evt) => calls.push(`swipe:${event.type}`),
    };
    const longPress = {
      onPointerDown: (event: Evt) => calls.push(`press:${event.type}`),
      onPointerMove: (event: Evt) => calls.push(`press:${event.type}`),
      onPointerUp: () => calls.push("press:up"),
      onPointerCancel: () => calls.push("press:cancel"),
      onPointerLeave: () => calls.push("press:leave"),
    };

    const composed = composeHandlers<Evt, [typeof swipe, typeof longPress]>(swipe, longPress);

    composed.onPointerDown({ type: "pointerdown" });
    composed.onPointerMove({ type: "pointermove" });
    composed.onPointerUp({ type: "pointerup" });
    composed.onPointerLeave({ type: "pointerleave" });

    assert.deepEqual(calls, [
      "swipe:pointerdown",
      "press:pointerdown",
      "swipe:pointermove",
      "press:pointermove",
      "swipe:pointerup",
      "press:up",
      "press:leave",
    ]);
  });

  it("exposes the union of names and skips undefined handlers", () => {
    const composed = composeHandlers<Evt, [{ onA: (e: Evt) => void; onB?: undefined }, { onB: (e: Evt) => void }]>(
      { onA: () => {}, onB: undefined },
      { onB: () => {} },
    );
    assert.deepEqual(Object.keys(composed).sort(), ["onA", "onB"]);
    assert.doesNotThrow(() => composed.onB({ type: "x" }));
  });
});
