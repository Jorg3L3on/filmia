import assert from "node:assert/strict";
import { describe, it } from "node:test";
import file from "../../data/cines-mx.json";
import { parseImcineFile } from "./cine-imcine";

describe("parseImcineFile", () => {
  it("accepts the checked-in file", () => {
    const { releases, issues } = parseImcineFile(file);
    assert.deepEqual(issues, []);
    assert.ok(releases.length >= 8);
    assert.ok(releases.some((release) => release.tmdbId === 1406492 && release.mxReleaseDate === "2026-10-22"));
  });

  it("reports a bad entry without dropping the rest", () => {
    const { releases, issues } = parseImcineFile({
      releases: [
        { tmdbId: 1, title: "Buena", mxReleaseDate: "2026-11-05", source: "imcine" },
        { tmdbId: 2, title: "Fecha mala", mxReleaseDate: "5 nov", source: "imcine" },
        { tmdbId: "3", title: "Id texto", mxReleaseDate: "2026-11-05", source: "imcine" },
        { tmdbId: null, title: "Sin TMDB", mxReleaseDate: "2026-11-12", source: "imcine" },
      ],
    });
    assert.deepEqual(releases.map((release) => release.title), ["Buena", "Sin TMDB"]);
    assert.deepEqual(issues.map((issue) => [issue.index, issue.title]), [[1, "Fecha mala"], [2, "Id texto"]]);
  });

  it("reports a file without releases", () => {
    assert.equal(parseImcineFile({}).issues.length, 1);
  });
});
