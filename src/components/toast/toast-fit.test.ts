import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { measureToastFit } from "@/components/toast/measure-toast-fit";

describe("toast copy at 375, 390, and 1280", () => {
  it("measures error, info, action, and progress without a dev server", async () => {
    await assert.doesNotReject(measureToastFit);
  });
});
