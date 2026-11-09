import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ignoreBenignViewTransitionRejections,
  isBenignViewTransitionRejection,
} from "@/lib/view-transition-noise";

const domError = (name: string, message: string) => Object.assign(new Error(message), { name });

describe("isBenignViewTransitionRejection", () => {
  it("accepts the skips React itself ignores", () => {
    assert.equal(
      isBenignViewTransitionRejection(domError("InvalidStateError", "Transition was aborted because of invalid state")),
      true,
    );
    assert.equal(
      isBenignViewTransitionRejection(domError("InvalidStateError", "Skipping view transition because viewport size changed.")),
      true,
    );
  });

  it("lets every other rejection through", () => {
    assert.equal(isBenignViewTransitionRejection(domError("InvalidStateError", "Something else")), false);
    assert.equal(
      isBenignViewTransitionRejection(domError("TypeError", "Transition was aborted because of invalid state")),
      false,
    );
    assert.equal(isBenignViewTransitionRejection("Transition was aborted because of invalid state"), false);
    assert.equal(isBenignViewTransitionRejection(null), false);
  });
});

describe("ignoreBenignViewTransitionRejections", () => {
  const fire = (reason: unknown) => {
    let listener: ((event: PromiseRejectionEvent) => void) | undefined;
    ignoreBenignViewTransitionRejections({
      addEventListener: ((type: string, fn: (event: PromiseRejectionEvent) => void) => {
        assert.equal(type, "unhandledrejection");
        listener = fn;
      }) as Window["addEventListener"],
    });
    const calls = { preventDefault: 0, stop: 0 };
    listener?.({
      reason,
      preventDefault: () => (calls.preventDefault += 1),
      stopImmediatePropagation: () => (calls.stop += 1),
    } as unknown as PromiseRejectionEvent);
    return calls;
  };

  it("handles the benign skip", () => {
    assert.deepEqual(fire(domError("InvalidStateError", "Transition was aborted because of invalid state")), {
      preventDefault: 1,
      stop: 1,
    });
  });

  it("leaves real errors alone", () => {
    assert.deepEqual(fire(new Error("boom")), { preventDefault: 0, stop: 0 });
  });
});
