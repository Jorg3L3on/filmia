import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  mergeStoredIntoRemote,
  splitCatalogSearch,
  storedTitleMatches,
  storedTitleRank,
  type StoredCatalogHit,
} from "@/lib/catalog-search";
import { tmdbListedTitle } from "@/lib/tmdb";

const mira: StoredCatalogHit = {
  id: "cat-mira",
  tmdbId: 501,
  kind: "MOVIE",
  name: "Luces del norte",
  originalName: "Northern Lights",
  alternateNames: ["Mira Norte"],
  year: 2014,
  posterPath: "/mira.jpg",
  backdropPath: null,
  overview: "Una historia inventada.",
};

const lumen: StoredCatalogHit = {
  id: "cat-lumen",
  tmdbId: 502,
  kind: "MOVIE",
  name: "Lumen",
  originalName: "Lumen",
  alternateNames: [],
  year: 2001,
  posterPath: null,
  backdropPath: null,
  overview: null,
};

const kaOld: StoredCatalogHit = {
  id: "cat-ka-1990",
  tmdbId: 503,
  kind: "MOVIE",
  name: "Ka",
  originalName: "Ka",
  alternateNames: ["Kay"],
  year: 1990,
  posterPath: null,
  backdropPath: null,
  overview: null,
};

const kaNew: StoredCatalogHit = {
  id: "cat-ka-2017",
  tmdbId: 504,
  kind: "MOVIE",
  name: "Ka",
  originalName: "Ka",
  alternateNames: [],
  year: 2017,
  posterPath: null,
  backdropPath: null,
  overview: null,
};

const shelf = [mira, lumen, kaOld, kaNew];

const idsFor = (query: string) => shelf.filter((film) => storedTitleMatches(film, query)).map((film) => film.id);

describe("stored catalog search (FIL-I48-2)", () => {
  it("finds the same stored film by the Mexican title, the original, or an alternate", () => {
    assert.deepEqual(idsFor("Luces del norte"), ["cat-mira"]);
    assert.deepEqual(idsFor("Northern Lights"), ["cat-mira"]);
    assert.deepEqual(idsFor("Mira Norte"), ["cat-mira"]);
    assert.equal(idsFor("Luces del norte")[0], idsFor("Northern Lights")[0]);
  });

  it("returns one film when the Mexican title and the original title are the same string", () => {
    assert.deepEqual(idsFor("Lumen"), ["cat-lumen"]);
    assert.equal(storedTitleRank(lumen, "Lumen"), 0);
  });

  it("uses a trailing year to separate two short names", () => {
    assert.deepEqual(idsFor("Ka").sort(), ["cat-ka-1990", "cat-ka-2017"]);
    assert.deepEqual(idsFor("Ka 1990"), ["cat-ka-1990"]);
    assert.deepEqual(idsFor("Kay"), ["cat-ka-1990"]);
    assert.deepEqual(splitCatalogSearch("Ka 1990"), { text: "Ka", year: 1990 });
  });

  it("still matches a title that literally ends in a year", () => {
    const named = { ...lumen, id: "cat-runner", name: "Corredor 2049", originalName: "Corredor 2049", year: 2017 };
    assert.equal(storedTitleMatches(named, "Corredor 2049"), true);
    assert.equal(storedTitleMatches({ ...named, name: "Corredor", originalName: "Corredor" }, "Corredor 2017"), true);
    assert.equal(storedTitleMatches({ ...named, name: "Corredor", originalName: "Corredor", year: 1982 }, "Corredor 2017"), false);
  });
});

describe("Buscar merge (FIL-I48-2)", () => {
  it("keeps TMDB's row, including both title strings, when the film is already on the page", () => {
    const remote = tmdbListedTitle({
      id: mira.tmdbId,
      name: "Luces del norte",
      originalName: "Northern Lights",
      date: "2014-04-01",
      posterPath: "/remote.jpg",
      backdropPath: null,
      overview: "Desde TMDB.",
    });
    assert.ok(remote);
    assert.equal(remote.originalName, "Northern Lights");
    const merged = mergeStoredIntoRemote([{ ...remote, kind: "MOVIE" }], [mira]);
    assert.equal(merged.length, 1);
    assert.equal(merged[0]?.overview, "Desde TMDB.");
    assert.equal(merged[0]?.originalName, "Northern Lights");
  });

  it("adds a stored film TMDB did not return, once, with both strings", () => {
    const remote = tmdbListedTitle({
      id: 900,
      name: "Otra",
      originalName: "Other",
      date: "1999-01-01",
      posterPath: null,
      backdropPath: null,
      overview: null,
    });
    assert.ok(remote);
    const merged = mergeStoredIntoRemote([{ ...remote, kind: "MOVIE" }], [mira, mira]);
    assert.deepEqual(
      merged.map((hit) => [hit.tmdbId, hit.name, hit.originalName]),
      [
        [mira.tmdbId, "Luces del norte", "Northern Lights"],
        [900, "Otra", "Other"],
      ],
    );
  });

  it("carries both strings when the es-MX title and the original title match", () => {
    const hit = tmdbListedTitle({
      id: lumen.tmdbId,
      name: "Lumen",
      originalName: "Lumen",
      date: "2001-01-01",
      posterPath: null,
      backdropPath: null,
      overview: null,
    });
    assert.deepEqual(hit && { name: hit.name, originalName: hit.originalName }, { name: "Lumen", originalName: "Lumen" });
  });

  it("does not ask TMDB for alternative titles on the search itself", () => {
    const source = readFileSync(new URL("./tmdb.ts", import.meta.url), "utf8");
    const search = source.slice(source.indexOf("export const searchTmdb ="), source.indexOf("export type TmdbDiscoverSort"));
    assert.equal(search.includes("alternative_titles"), false);
    assert.match(search, /\/search\/multi/);
    assert.match(search, /tmdbListedTitle/);

    const facts = readFileSync(new URL("../app/actions/search-facts.ts", import.meta.url), "utf8");
    assert.match(facts, /getStoredCatalogHits/);
    assert.equal(facts.includes("alternative_titles"), false);
    assert.match(facts, /eq\(catalog\.tmdbId, item\.tmdbId\)/);

    const queries = readFileSync(new URL("./queries.ts", import.meta.url), "utf8");
    assert.match(queries, /catalogTitlesMatchSql/);
    assert.equal(queries.includes("jsonb_array_elements_text"), false);

    const sql = readFileSync(new URL("./catalog-search-db.ts", import.meta.url), "utf8");
    assert.match(sql, /ilike\(catalog\.name/);
    assert.match(sql, /ilike\(catalog\.originalName/);
    assert.match(sql, /jsonb_array_elements_text/);

    const metadata = readFileSync(new URL("../app/actions/metadata.ts", import.meta.url), "utf8");
    assert.match(metadata, /searchTmdbCatalogPage/);
    assert.match(metadata, /getStoredCatalogHits/);
    assert.equal(metadata.includes("alternative_titles"), false);
  });
});
