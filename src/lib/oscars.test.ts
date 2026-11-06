import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  OSCAR_CATEGORY_ES,
  OSCAR_DATA_SHA,
  oscarCategoryEs,
  oscarYear,
  oscarsFor,
  parseOscarsTsv,
  type OscarIndex,
} from "@/lib/oscars-core";

// Real public rows of DLu/oscar_data @ c5e9716 (FIL-I43). `@/lib/oscars` itself is server-only, so
// the tests read the same data through the pure core.
const fixture = parseOscarsTsv(
  readFileSync(new URL("../../scripts/fixtures/oscars-sample.tsv", import.meta.url), "utf8"),
  { repo: "DLu/oscar_data", sha: OSCAR_DATA_SHA, builtAt: "2026-11-06" },
);
const built = JSON.parse(
  readFileSync(new URL("../data/oscars-by-person.json", import.meta.url), "utf8"),
) as OscarIndex;

const DEAKINS = "nm0005683";
const SPIELBERG = "nm0000229";
const REEVES = "nm0000206";

describe("oscars/core", () => {
  it("maps ceremonies to the year they were held", () => {
    assert.equal(oscarYear(1), 1929);
    assert.equal(oscarYear(66), 1994);
    assert.equal(oscarYear(98), 2026);
  });

  it("Deakins: 2 wins in Mejor fotografía, newest first, 16 nominations", () => {
    const deakins = oscarsFor(fixture, DEAKINS);
    assert.ok(deakins);
    assert.equal(deakins.nominations, 16);
    assert.deepEqual(
      deakins.wins.map((win) => [win.year, win.categoryEs, win.film?.title, win.film?.imdbId]),
      [
        [2020, "Mejor fotografía", "1917", "tt8579674"],
        [2018, "Mejor fotografía", "Blade Runner 2049", "tt1856101"],
      ],
    );
  });

  it("Spielberg: two wins at one ceremony in category order, and Thalberg without a film", () => {
    const spielberg = oscarsFor(fixture, SPIELBERG);
    assert.ok(spielberg);
    assert.deepEqual(
      spielberg.wins.map((win) => [win.year, win.categoryEs, win.film?.title ?? null]),
      [
        [1999, "Mejor dirección", "Saving Private Ryan"],
        [1994, "Mejor película (producción)", "Schindler's List"],
        [1994, "Mejor dirección", "Schindler's List"],
        [1987, "Premio Irving G. Thalberg", null],
      ],
    );
    // 1978 Dirección + 1999 Película are nominations without a win.
    assert.equal(spielberg.nominations, 6);
  });

  it("keeps every nomination that did not win, newest first (FIL-I45-1)", () => {
    const deakins = oscarsFor(fixture, DEAKINS);
    assert.ok(deakins);
    assert.equal(deakins.wins.length, 2);
    assert.equal(deakins.nominated.length, 14);
    assert.equal(deakins.wins.length + deakins.nominated.length, deakins.nominations);
    assert.deepEqual(
      deakins.nominated.slice(0, 3).map((entry) => [entry.year, entry.film?.title]),
      [
        [2023, "Empire of Light"],
        [2016, "Sicario"],
        [2015, "Unbroken"],
      ],
    );
    assert.deepEqual(
      oscarsFor(fixture, SPIELBERG)?.nominated.map((entry) => [entry.year, entry.categoryEs, entry.film?.title]),
      [
        [1999, "Mejor película (producción)", "Saving Private Ryan"],
        [1978, "Mejor dirección", "Close Encounters of the Third Kind"],
      ],
    );
  });

  it("keeps the first film of a multi-film row as one award", () => {
    const jannings = oscarsFor(fixture, "nm0417837");
    assert.ok(jannings);
    assert.equal(jannings.wins.length, 1);
    assert.deepEqual(jannings.wins[0]?.film, { title: "The Last Command", imdbId: "tt0019071" });
  });

  it("skips `?` ids and keeps the named nominee of the same row", () => {
    assert.equal(Object.hasOwn(fixture.people, "?"), false);
    assert.deepEqual(oscarsFor(fixture, "nm0914249"), {
      wins: [],
      nominated: [
        {
          ceremony: 12,
          year: 1940,
          category: "SOUND RECORDING",
          categoryEs: "Mejor grabación de sonido",
          film: { title: "Goodbye, Mr. Chips", imdbId: "tt0031385" },
        },
      ],
      nominations: 1,
    });
  });

  it("ignores SciTech and commendation rows entirely", () => {
    assert.equal(oscarsFor(fixture, "nm0413164"), null);
    assert.equal(oscarsFor(fixture, "nm0768167"), null);
  });

  it("returns null for unknown, empty and prototype ids", () => {
    assert.equal(oscarsFor(fixture, REEVES), null);
    assert.equal(oscarsFor(fixture, null), null);
    assert.equal(oscarsFor(fixture, ""), null);
    assert.equal(oscarsFor(fixture, "constructor"), null);
  });

  it("falls back to the English name for an unknown category", () => {
    assert.equal(oscarCategoryEs("BEST CASTING (2026)"), "BEST CASTING (2026)");
  });
});

describe("oscars/built JSON", () => {
  it("is pinned and covers ceremonies 1–98", () => {
    assert.equal(built.source.repo, "DLu/oscar_data");
    assert.equal(built.source.sha, OSCAR_DATA_SHA);
    assert.deepEqual(built.source.ceremonies, [1, 98]);
  });

  it("matches the facts the person view shows", () => {
    const deakins = oscarsFor(built, DEAKINS);
    assert.equal(deakins?.wins.length, 2);
    assert.equal(deakins?.nominations, 16);
    const thalberg = oscarsFor(built, SPIELBERG)?.wins.find((win) => win.category === "IRVING G. THALBERG MEMORIAL AWARD");
    assert.deepEqual(thalberg && [thalberg.year, thalberg.categoryEs, thalberg.film], [1987, "Premio Irving G. Thalberg", null]);
    assert.equal(oscarsFor(built, REEVES), null);
    assert.equal(deakins?.nominated.length, 14);
    // Ridley Scott: four nominations, no win (FIL-I45 canvas).
    assert.deepEqual(
      oscarsFor(built, "nm0000631")?.nominated.map((entry) => [entry.year, entry.categoryEs, entry.film?.title]),
      [
        [2016, "Mejor película (producción)", "The Martian"],
        [2002, "Mejor dirección", "Black Hawk Down"],
        [2001, "Mejor dirección", "Gladiator"],
        [1992, "Mejor dirección", "Thelma & Louise"],
      ],
    );
    assert.equal(oscarsFor(built, "nm0000631")?.wins.length, 0);
  });

  it("has a Spanish label for every category it holds (a new one fails here on the yearly rebuild)", () => {
    const categories = new Set(
      Object.values(built.people).flatMap((person) => [...(person.w ?? []), ...(person.x ?? [])].map((entry) => entry[1])),
    );
    const missing = [...categories].filter((category) => !Object.hasOwn(OSCAR_CATEGORY_ES, category));
    assert.deepEqual(missing, []);
    assert.equal([...categories].some((category) => /SCIENTIFIC|COMMENDATION|SAWYER/.test(category)), false);
  });
});
