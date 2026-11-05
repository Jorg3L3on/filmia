import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { CONNECTION_TOAST_KEY, isNavigationFetch, navigationTarget, watchNavigationFailures } from "@/lib/connection-watch";
import { dismissToast, getToasts } from "@/lib/toast";

const offline: typeof fetch = async () => {
  throw new TypeError("Failed to fetch");
};

describe("navigation without signal says «Conexión perdida» (UX-17)", () => {
  beforeEach(() => {
    for (const item of getToasts()) dismissToast(item.id);
  });

  it("reports a failed RSC navigation with «Reintentar» to the same page", async () => {
    const went: string[] = [];
    const watched = watchNavigationFailures(offline, (path) => went.push(path), () => "https://filmia.test/");
    // Held, not rejected: Next would otherwise fall back to a browser navigation that fails offline.
    const held = watched("https://filmia.test/listas?_rsc=abc", { headers: { rsc: "1" } });
    const settled = await Promise.race([held.then(() => "settled", () => "settled"), new Promise((r) => setTimeout(() => r("held"), 20))]);
    assert.equal(settled, "held");
    const toast = getToasts().find((item) => item.key === CONNECTION_TOAST_KEY);
    assert.equal(toast?.title, "Conexión perdida");
    assert.equal(toast?.description, "Revisa tu señal y vuelve a intentarlo.");
    assert.equal(toast?.action?.label, "Reintentar");
    toast?.action?.onClick();
    assert.deepEqual(went, ["/listas"]);
  });

  it("stays quiet for prefetches, actions and plain fetches", async () => {
    const watched = watchNavigationFailures(offline, () => {}, () => "https://filmia.test/");
    for (const headers of <Record<string, string>[]>[
      { rsc: "1", "next-router-prefetch": "1" },
      { rsc: "1", "next-router-segment-prefetch": "/_tree" },
      { "next-action": "abc" },
      {},
    ]) {
      await assert.rejects(watched("https://filmia.test/listas", { headers }));
    }
    assert.equal(getToasts().length, 0);
    assert.equal(isNavigationFetch("https://filmia.test/x", { headers: { rsc: "1" } }), true);
    assert.equal(navigationTarget("/diario?mes=2026-10&_rsc=1", "https://filmia.test/"), "/diario?mes=2026-10");
  });
});
