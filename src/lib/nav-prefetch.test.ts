import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  NAV_PREFETCH_HREFS,
  NAV_PREFETCH_POLICY_OFF,
  collectWarmNavHrefs,
  prioritizeNavHrefs,
  resolveNavPrefetchPolicy,
} from "./nav-prefetch";

describe("warm nav hrefs", () => {
  it("skips the current path and dedupes recent fichas", () => {
    assert.deepEqual(
      collectWarmNavHrefs("/watchlist", ["/titulos/a", "/titulos/a", "/watchlist"]),
      [
        "/",
        "/buscar",
        "/listas",
        "/tags",
        "/perfil",
        "/titulos/a",
      ],
    );
  });

  it("keeps the six app surfaces", () => {
    assert.deepEqual([...NAV_PREFETCH_HREFS], [
      "/",
      "/watchlist",
      "/buscar",
      "/listas",
      "/perfil",
      "/tags",
    ]);
    assert.ok(!collectWarmNavHrefs("/").includes("/"));
  });

  it("respects slow-network budgets (fewer routes, no fichas on 2g)", () => {
    const slow = resolveNavPrefetchPolicy({ effectiveType: "2g" });
    assert.equal(slow.maxNavHrefs, 1);
    assert.equal(slow.maxRecentFichas, 0);
    assert.ok(slow.staggerMs > 0);

    const hrefs = collectWarmNavHrefs(
      "/watchlist",
      ["/titulos/a", "/titulos/b"],
      slow,
    );
    assert.equal(hrefs.length, 1);
    assert.equal(hrefs[0], "/"); // neighbor of Quiero ver
    assert.ok(!hrefs.includes("/titulos/a"));
  });

  it("keeps a mid budget on 3g", () => {
    const mid = resolveNavPrefetchPolicy({ effectiveType: "3g" });
    assert.equal(mid.maxNavHrefs, 3);
    assert.equal(mid.maxRecentFichas, 1);

    const hrefs = collectWarmNavHrefs(
      "/listas",
      ["/titulos/a", "/titulos/b"],
      mid,
    );
    assert.equal(hrefs.filter((h) => !h.startsWith("/titulos/")).length, 3);
    assert.equal(hrefs.filter((h) => h.startsWith("/titulos/")).length, 1);
    assert.ok(hrefs.includes("/titulos/a"));
    assert.ok(!hrefs.includes("/titulos/b"));
  });

  it("disables warm nav under Save-Data", () => {
    assert.deepEqual(
      resolveNavPrefetchPolicy({ saveData: true }),
      NAV_PREFETCH_POLICY_OFF,
    );
    assert.deepEqual(
      collectWarmNavHrefs("/buscar", ["/titulos/a"], NAV_PREFETCH_POLICY_OFF),
      [],
    );
  });

  it("prioritizes soft-nav neighbors of the current surface", () => {
    assert.deepEqual(prioritizeNavHrefs("/watchlist", ["/", "/perfil", "/buscar"]), [
      "/",
      "/buscar",
      "/perfil",
    ]);
  });
});
