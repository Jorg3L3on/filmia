import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseKindFilter, parsePlatformFilters } from "@/lib/catalog-filters";
import { catalogHref, parseMinePlatforms } from "@/lib/catalog-href";

/**
 * Regression (FIL-I34): Quiero ver moved to its own params (`watchlist-query.ts`); Diario and
 * Listas keep building and reading theirs exactly as before.
 */
describe("catalog-href/Diario and Listas unchanged", () => {
  it("Diario: view, sort, month, day, mode", () => {
    assert.equal(catalogHref("/historial", { view: "deck", defaultView: "deck" }), "/historial");
    assert.equal(
      catalogHref("/historial", { view: "calendar", defaultView: "deck", month: "2026-10", day: "2026-10-12", sort: "rating" }),
      "/historial?view=calendar&sort=rating&month=2026-10&day=2026-10-12",
    );
    assert.equal(catalogHref("/historial", { view: "grid", day: "2026-10-12" }), "/historial?view=grid");
    assert.equal(catalogHref("/historial", { mode: "picks" }), "/historial");
    assert.equal(catalogHref("/historial", { mode: "all" }), "/historial?mode=all");
  });

  it("Listas: kind, platforms, series status, Mis plataformas", () => {
    assert.equal(
      catalogHref("/listas/abc", { kind: "SERIES", seriesStatus: "WATCHING", platforms: ["MAX", "NETFLIX"], minePlatforms: true }),
      "/listas/abc?minePlatforms=1&seriesStatus=WATCHING&kind=SERIES&platform=NETFLIX&platform=MAX",
    );
    assert.equal(catalogHref("/listas/abc", { kind: "ALL", platforms: [] }), "/listas/abc");
  });

  it("parses the shared params the same way", () => {
    assert.equal(parseMinePlatforms(["0", "on"]), true);
    assert.equal(parseKindFilter("movie"), "MOVIE");
    assert.equal(parseKindFilter("anime"), "ALL");
    assert.deepEqual(parsePlatformFilters(["max,netflix", "nope"]), ["NETFLIX", "MAX"]);
  });
});
