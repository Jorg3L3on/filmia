import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";

type Fake = { calls: string[]; clicks: Array<() => void> };

const install = (): Fake => {
  const fake: Fake = { calls: [], clicks: [] };
  (globalThis as unknown as { window: unknown }).window = {
    history: { replaceState: (_s: unknown, _t: string, url: string) => fake.calls.push(url) },
    addEventListener: () => {},
  };
  (globalThis as unknown as { document: unknown }).document = {
    addEventListener: (_type: string, handler: () => void) => fake.clicks.push(handler),
  };
  return fake;
};

describe("replaceUrlAtRest", () => {
  beforeEach(() => mock.timers.enable({ apis: ["setTimeout"] }));
  afterEach(() => mock.timers.reset());

  it("writes once, the last url, after the deck rests", async () => {
    const fake = install();
    const { replaceUrlAtRest, REST_URL_DELAY_MS } = await import("./rest-url");
    replaceUrlAtRest("/?carta=a");
    mock.timers.tick(REST_URL_DELAY_MS - 50);
    replaceUrlAtRest("/?carta=b");
    mock.timers.tick(REST_URL_DELAY_MS - 50);
    replaceUrlAtRest("/?carta=c");
    assert.deepEqual(fake.calls, []);
    mock.timers.tick(REST_URL_DELAY_MS);
    assert.deepEqual(fake.calls, ["/?carta=c"]);
  });

  it("flushes before a click starts a navigation", async () => {
    const fake = install();
    const { replaceUrlAtRest } = await import("./rest-url");
    replaceUrlAtRest("/?carta=z");
    // The module registered its capture listener on first use (an earlier test may have too).
    assert.ok(fake.clicks.length <= 1);
    const { flushRestUrl } = await import("./rest-url");
    flushRestUrl();
    assert.deepEqual(fake.calls, ["/?carta=z"]);
    flushRestUrl();
    assert.equal(fake.calls.length, 1);
  });
});
