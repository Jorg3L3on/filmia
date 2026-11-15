import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";

type Fake = {
  calls: string[];
  location: { pathname: string };
  windowListeners: Map<string, () => void>;
};

const install = (): Fake => {
  const fake: Fake = { calls: [], location: { pathname: "/" }, windowListeners: new Map() };
  (globalThis as unknown as { window: unknown }).window = {
    location: fake.location,
    history: { replaceState: (_s: unknown, _t: string, url: string) => fake.calls.push(url) },
    addEventListener: (type: string, handler: () => void) => fake.windowListeners.set(type, handler),
  };
  (globalThis as unknown as { document: unknown }).document = {
    addEventListener: () => {},
  };
  return fake;
};

describe("replaceUrlAtRest", () => {
  beforeEach(() => mock.timers.enable({ apis: ["setTimeout"] }));
  afterEach(async () => {
    const { dropRestUrl } = await import("./rest-url");
    dropRestUrl();
    mock.timers.reset();
  });

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
    const { replaceUrlAtRest, flushRestUrl } = await import("./rest-url");
    replaceUrlAtRest("/?carta=z");
    flushRestUrl();
    assert.deepEqual(fake.calls, ["/?carta=z"]);
    flushRestUrl();
    assert.equal(fake.calls.length, 1);
  });

  it("drops the write when the page changed before it ran", async () => {
    const fake = install();
    const { replaceUrlAtRest, REST_URL_DELAY_MS } = await import("./rest-url");
    replaceUrlAtRest("/?carta=q");
    fake.location.pathname = "/titulos/123";
    mock.timers.tick(REST_URL_DELAY_MS);
    assert.deepEqual(fake.calls, []);
  });

  it("drops the write on Back/forward", async () => {
    const fake = install();
    const { replaceUrlAtRest, dropRestUrl, REST_URL_DELAY_MS } = await import("./rest-url");
    replaceUrlAtRest("/?carta=p");
    // The module registers its listeners once per process; call what it registered (or the
    // same function directly when an earlier test's fake window got the listener).
    (fake.windowListeners.get("popstate") ?? dropRestUrl)();
    mock.timers.tick(REST_URL_DELAY_MS);
    assert.deepEqual(fake.calls, []);
  });
});
