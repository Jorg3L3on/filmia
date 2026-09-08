import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { staggerStyle } from "./motion";

describe("staggerStyle", () => {
  it("sets CSS custom properties for stagger-in", () => {
    const style = staggerStyle(3, 40) as Record<string, string | number>;
    assert.equal(style["--stagger"], 3);
    assert.equal(style["--stagger-step"], "40ms");
  });

  it("defaults the step to 50ms", () => {
    const style = staggerStyle(0) as Record<string, string | number>;
    assert.equal(style["--stagger-step"], "50ms");
  });
});
