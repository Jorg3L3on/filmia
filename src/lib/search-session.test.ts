import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  SEARCH_CACHE_TTL_MS,
  buildSearchHref,
  clearSearchCache,
  createDebounced,
  normalizeSearchQuery,
  readSearchCache,
  searchCacheKey,
  writeSearchCache,
} from "./search-session";

afterEach(() => {
  clearSearchCache();
});

describe("normalizeSearchQuery", () => {
  it("trims and collapses inner spaces", () => {
    assert.equal(normalizeSearchQuery("  Dune   parte  "), "Dune parte");
    assert.equal(searchCacheKey("  Dune   Parte  "), "dune parte");
  });
});

describe("search cache", () => {
  it("returns a fresh hit and expires a stale one", () => {
    writeSearchCache("Dune", { results: [], error: null }, 1_000);
    assert.equal(readSearchCache("dune", 1_000)?.error, null);
    assert.equal(readSearchCache("dune", 1_000 + SEARCH_CACHE_TTL_MS + 1), null);
  });

  it("ignores blank queries", () => {
    writeSearchCache("   ", { results: [], error: "x" }, 1);
    assert.equal(readSearchCache("   ", 1), null);
  });
});

describe("buildSearchHref", () => {
  it("omits the query string when empty", () => {
    assert.equal(buildSearchHref("  "), "/buscar");
  });

  it("keeps watched extras", () => {
    assert.equal(
      buildSearchHref("Dune", { watchedDate: "2026-01-02", watchedDestination: true }),
      "/buscar?q=Dune&fecha=2026-01-02&destino=visto",
    );
  });
});

describe("createDebounced", () => {
  it("runs the last call after the wait", async () => {
    const seen: string[] = [];
    const debounce = createDebounced((value: string) => {
      seen.push(value);
    }, 20);

    debounce.run("a");
    debounce.run("ab");
    debounce.run("abc");
    await new Promise((resolve) => setTimeout(resolve, 40));
    assert.deepEqual(seen, ["abc"]);
  });

  it("cancel prevents a pending run", async () => {
    const seen: string[] = [];
    const debounce = createDebounced((value: string) => {
      seen.push(value);
    }, 20);

    debounce.run("nope");
    debounce.cancel();
    await new Promise((resolve) => setTimeout(resolve, 40));
    assert.deepEqual(seen, []);
  });
});
