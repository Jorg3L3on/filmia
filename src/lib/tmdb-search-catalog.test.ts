import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  lookupTmdbCatalogEntry,
  tmdbCatalogKey,
  toTmdbCatalogMap,
} from "./tmdb-search-catalog";

describe("tmdb search catalog map", () => {
  it("indexes by kind:id and bare tmdb id", () => {
    const catalog = toTmdbCatalogMap([
      {
        tmdbId: 438631,
        kind: "MOVIE",
        titleId: "title-1",
        inWatchlist: true,
        watched: false,
      },
    ]);

    assert.equal(tmdbCatalogKey(438631, "MOVIE"), "MOVIE:438631");
    assert.equal(lookupTmdbCatalogEntry(catalog, 438631, "MOVIE")?.titleId, "title-1");
    assert.equal(catalog.get("438631")?.inWatchlist, true);
    assert.equal(lookupTmdbCatalogEntry(catalog, 1, "MOVIE"), null);
  });
});
