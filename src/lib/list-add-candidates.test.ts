import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { TmdbCatalogResult } from "./tmdb";
import { mergeListAddCandidates, type LocalListTitle } from "./list-add-candidates";

const hit = (
  tmdbId: number,
  name: string,
  kind: TmdbCatalogResult["kind"] = "MOVIE",
  originalName: string | null = null,
): TmdbCatalogResult => ({
  tmdbId,
  kind,
  name,
  originalName,
  year: 2014,
  posterPath: null,
  backdropPath: null,
  overview: null,
});

const interstellar: LocalListTitle = {
  id: "t-inter",
  name: "Interestelar",
  year: 2014,
  posterPath: null,
  tmdbId: 157336,
  kind: "MOVIE",
};
const manual: LocalListTitle = {
  id: "t-manual",
  name: "Inter casero",
  year: null,
  posterPath: null,
  tmdbId: null,
  kind: null,
};
const severance: LocalListTitle = {
  id: "t-sev",
  name: "Separación",
  year: 2022,
  posterPath: null,
  tmdbId: 95396,
  kind: "SERIES",
};

const none = new Set<string>();

describe("mergeListAddCandidates", () => {
  it("shows every local title and no TMDB block without a query", () => {
    const merged = mergeListAddCandidates({
      local: [interstellar, manual],
      query: "  ",
      tmdbResults: [hit(1, "Algo")],
      inListKeys: none,
      addedKeys: none,
    });
    assert.deepEqual(merged.local.map((title) => title.id), ["t-inter", "t-manual"]);
    assert.deepEqual(merged.tmdb, []);
  });

  it("hides titles added in this session even without a query", () => {
    const merged = mergeListAddCandidates({
      local: [interstellar, manual],
      query: "",
      tmdbResults: [],
      inListKeys: none,
      addedKeys: new Set(["t-inter"]),
    });
    assert.deepEqual(merged.local.map((title) => title.id), ["t-manual"]);
  });

  it("keeps local matches and drops the TMDB twin of a shown local title", () => {
    const merged = mergeListAddCandidates({
      local: [interstellar, manual, severance],
      query: "inter",
      tmdbResults: [hit(157336, "Interstellar"), hit(999, "Interstate 60")],
      inListKeys: none,
      addedKeys: none,
    });
    assert.deepEqual(merged.local.map((title) => title.id), ["t-inter", "t-manual"]);
    assert.deepEqual(
      merged.tmdb.map((candidate) => [candidate.key, candidate.state]),
      [["MOVIE:999", "new"]],
    );
  });

  it("turns a TMDB hit into a local add when its twin missed the text filter", () => {
    const merged = mergeListAddCandidates({
      local: [severance],
      query: "severance",
      tmdbResults: [hit(95396, "Severance", "SERIES")],
      inListKeys: none,
      addedKeys: none,
    });
    assert.deepEqual(merged.local, []);
    assert.equal(merged.tmdb[0]?.state, "local");
    assert.equal(merged.tmdb[0]?.titleId, "t-sev");
  });

  it("flags hits already on the list or added in this session", () => {
    const merged = mergeListAddCandidates({
      local: [],
      query: "dune",
      tmdbResults: [hit(438631, "Dune"), hit(693134, "Dune: Parte dos"), hit(841, "Dune 1984")],
      inListKeys: new Set(["MOVIE:438631"]),
      addedKeys: new Set(["MOVIE:693134"]),
    });
    assert.deepEqual(
      merged.tmdb.map((candidate) => candidate.state),
      ["in-list", "in-list", "new"],
    );
  });

  it("dedupes by kind + tmdbId so a movie and a series with the same id both stay", () => {
    const merged = mergeListAddCandidates({
      local: [],
      query: "x",
      tmdbResults: [hit(10, "X"), hit(10, "X", "SERIES"), hit(10, "X again")],
      inListKeys: none,
      addedKeys: none,
    });
    assert.deepEqual(
      merged.tmdb.map((candidate) => candidate.key),
      ["MOVIE:10", "SERIES:10"],
    );
  });

  it("never dedupes manual titles without tmdbId", () => {
    const merged = mergeListAddCandidates({
      local: [manual],
      query: "inter",
      tmdbResults: [hit(157336, "Interstellar")],
      inListKeys: none,
      addedKeys: none,
    });
    assert.deepEqual(merged.local.map((title) => title.id), ["t-manual"]);
    assert.equal(merged.tmdb[0]?.state, "new");
  });
});
