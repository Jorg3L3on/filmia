import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { OSCAR_DATA_SHA } from "@/lib/oscars-core";
import {
  buildOscarCeremony,
  findNominee,
  nomineeDetail,
  nomineeName,
  oscarBallotPhase,
  oscarCeremonyFor,
  scoreOscarBallot,
  unknownBallotCategories,
  type OscarCeremonyFile,
} from "@/lib/juegos/oscar/ceremony-core";
import { getOscarCeremony, oscarSeasonYear } from "@/lib/juegos/oscar/ceremonies";

// Real public rows of DLu/oscar_data @ c5e9716: every row of the 96th ceremony (2024).
const tsv = readFileSync(new URL("../../../../scripts/fixtures/oscars-2024.tsv", import.meta.url), "utf8");
const source = { repo: "DLu/oscar_data", sha: OSCAR_DATA_SHA, builtAt: "2026-11-12" };
const built = buildOscarCeremony(tsv, 2024, source);

describe("quiniela/ceremony file (FIL-I51-1)", () => {
  it("builds the 2024 ceremony with its 23 categories, in ballot order", () => {
    assert.equal(built.ceremony, 96);
    assert.equal(built.year, 2024);
    assert.equal(built.categories.length, 23);
    assert.deepEqual(
      built.categories.slice(0, 6).map((category) => category.id),
      ["pelicula", "direccion", "actriz", "actor", "actriz-reparto", "actor-reparto"],
    );
    assert.deepEqual(unknownBallotCategories(built), []);
    // Honorary and technical awards are given, not voted on.
    assert.ok(!built.categories.some((category) => /HONORARY|HERSHOLT|SCIENTIFIC/.test(category.canonical)));
  });

  it("keeps every nominee: 10 for Best Picture, 5 elsewhere", () => {
    const counts = Object.fromEntries(built.categories.map((category) => [category.id, category.nominees.length]));
    assert.equal(counts.pelicula, 10);
    for (const [id, count] of Object.entries(counts)) {
      if (id !== "pelicula") assert.equal(count, 5, id);
    }
    for (const category of built.categories) {
      assert.equal(new Set(category.nominees.map((nominee) => nominee.id)).size, category.nominees.length, category.id);
    }
  });

  it("people, songs and countries read the way the ballot shows them", () => {
    const actress = findNominee(built, "actriz", "nm1297015");
    assert.ok(actress);
    assert.equal(nomineeName(actress), "Emma Stone");
    assert.equal(nomineeDetail(actress), "Poor Things");

    const songs = built.categories.find((category) => category.id === "cancion")!;
    // Barbie has two songs in the category: each its own nominee.
    assert.deepEqual(
      songs.nominees.filter((nominee) => nominee.film.imdbId === "tt1517268").map(nomineeName),
      ["«I'm Just Ken»", "«What Was I Made For?»"],
    );

    const zone = findNominee(built, "internacional", "tt7160372");
    assert.ok(zone);
    assert.equal(nomineeName(zone), "The Zone of Interest");
    assert.equal(nomineeDetail(zone), "United Kingdom");
  });

  it("prefers the Mexican title once TMDB filled it", () => {
    const nominee = { id: "tt14230458", film: { title: "Poor Things", imdbId: "tt14230458", titleEs: "Pobres criaturas" } };
    assert.equal(nomineeName(nominee), "Pobres criaturas");
  });

  it("the committed 2024 file is what the script builds from the fixture", () => {
    const committed = getOscarCeremony(2024) as OscarCeremonyFile;
    assert.ok(committed);
    const strip = (file: OscarCeremonyFile) => JSON.parse(JSON.stringify({ ...file, source: null })) as unknown;
    assert.deepEqual(strip(committed), strip(built));
  });

  it("fails loudly for a ceremony that is not in the file", () => {
    assert.throws(() => buildOscarCeremony(tsv, 2027, source), /ceremony 99 \(2027\)/);
    assert.equal(oscarCeremonyFor(2027), 99);
  });

  it("the season is 2027 unless a local override names another ceremony", () => {
    assert.equal(oscarSeasonYear(undefined), 2027);
    assert.equal(oscarSeasonYear("2024"), 2024);
    assert.equal(oscarSeasonYear("nope"), 2027);
    assert.equal(getOscarCeremony(1999), null);
  });
});

describe("quiniela/ballot phase", () => {
  const now = new Date("2027-03-14T23:00:00Z");
  it("is «pronto» without a ceremony file or closing time", () => {
    assert.equal(oscarBallotPhase({ hasCeremony: false, closesAt: null, now }), "pronto");
    assert.equal(oscarBallotPhase({ hasCeremony: true, closesAt: null, now }), "pronto");
  });
  it("is open until the closing time and closed from it on", () => {
    assert.equal(oscarBallotPhase({ hasCeremony: true, closesAt: new Date("2027-03-14T23:00:01Z"), now }), "abierta");
    assert.equal(oscarBallotPhase({ hasCeremony: true, closesAt: now, now }), "cerrada");
  });
});

describe("quiniela/score (FIL-I51-1)", () => {
  const ids = built.categories.map((category) => category.id);
  const votes = { pelicula: "tt15398776", direccion: "nm0634240", actriz: "nm4291409", actor: "nm0614165" };

  it("counts nothing before any winner", () => {
    const score = scoreOscarBallot(ids, votes, {});
    assert.deepEqual(
      [score.hits, score.announced, score.total, score.remaining, score.voted],
      [0, 0, 23, 23, 4],
    );
    assert.ok(score.results.every((result) => result.hit === null));
  });

  it("partial winners: hits, misses and categories still open", () => {
    const score = scoreOscarBallot(ids, votes, {
      actriz: "nm1297015", // Emma Stone; the ballot said Lily Gladstone
      direccion: "nm0634240", // Nolan, a hit
      fotografia: "tt15398776", // announced, not voted
    });
    assert.equal(score.hits, 1);
    assert.equal(score.announced, 3);
    assert.equal(score.remaining, 20);
    const byId = Object.fromEntries(score.results.map((result) => [result.categoryId, result]));
    assert.equal(byId.actriz?.hit, false);
    assert.equal(byId.direccion?.hit, true);
    assert.equal(byId.fotografia?.hit, false);
    assert.equal(byId.pelicula?.hit, null);
  });

  it("complete winners: the final score", () => {
    const winners = Object.fromEntries(built.categories.map((category) => [category.id, category.nominees[0]!.id]));
    const allFirst = { ...winners };
    const score = scoreOscarBallot(ids, allFirst, winners);
    assert.deepEqual([score.hits, score.announced, score.remaining], [23, 23, 0]);
    const oneWrong = { ...allFirst, pelicula: "tt15398776" };
    assert.equal(scoreOscarBallot(ids, oneWrong, winners).hits, 22);
  });

  it("ignores votes and winners for categories the ceremony does not have", () => {
    const score = scoreOscarBallot(["pelicula"], { pelicula: "a", inventada: "b" }, { pelicula: "a", inventada: "b" });
    assert.deepEqual([score.hits, score.total, score.voted], [1, 1, 1]);
  });
});
