import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  SEARCH_CACHE_TTL_MS,
  buildSearchHref,
  parseSearchKind,
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

  it("keeps titles and director searches of the same words apart", () => {
    const fincher = { id: 7467, name: "David Fincher", profilePath: null, popularity: 4 };
    writeSearchCache("fincher", { results: [], error: null, director: fincher }, 1_000);
    writeSearchCache("fincher", { results: [], error: null, directors: [fincher] }, 1_000, "director");
    assert.equal(searchCacheKey("Fincher", "director"), "director:fincher");
    assert.equal(readSearchCache("fincher", 1_000)?.director?.id, 7467);
    assert.equal(readSearchCache("fincher", 1_000)?.directors, undefined);
    assert.equal(readSearchCache("fincher", 1_000, "director")?.directors?.length, 1);
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

  it("marks the director mode with tipo=director", () => {
    assert.equal(buildSearchHref("fincher", { mode: "director" }), "/buscar?q=fincher&tipo=director");
    assert.equal(buildSearchHref("fincher", { mode: "titles" }), "/buscar?q=fincher");
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

describe("search-session/kind chip in the URL", () => {
  it("keeps Películas / Series in ?tipo= so Back restores the chip", () => {
    assert.equal(buildSearchHref("Dune", { kind: "MOVIE" }), "/buscar?q=Dune&tipo=pelicula");
    assert.equal(buildSearchHref("Dune", { kind: "SERIES" }), "/buscar?q=Dune&tipo=serie");
    assert.equal(buildSearchHref("Dune", { kind: "ALL" }), "/buscar?q=Dune");
    assert.equal(buildSearchHref("fincher", { mode: "director", kind: "MOVIE" }), "/buscar?q=fincher&tipo=director");
  });

  it("parses ?tipo= back into the chip", () => {
    assert.equal(parseSearchKind("pelicula"), "MOVIE");
    assert.equal(parseSearchKind(["serie"]), "SERIES");
    assert.equal(parseSearchKind("director"), "ALL");
    assert.equal(parseSearchKind(undefined), "ALL");
  });
});
