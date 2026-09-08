import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { collectWarmNavHrefs, NAV_PREFETCH_HREFS } from "./nav-prefetch";

describe("warm nav hrefs", () => {
  it("skips the current path and dedupes recent fichas", () => {
    assert.deepEqual(
      collectWarmNavHrefs("/watchlist", ["/titulos/a", "/titulos/a", "/watchlist"]),
      [
        "/",
        "/buscar",
        "/listas",
        "/perfil",
        "/tags",
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
});
