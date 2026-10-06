import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { awardChipLabel, parseOmdbAwards } from "@/lib/awards";

describe("awards/parseOmdbAwards", () => {
  it("reads a won head plus totals", () => {
    assert.deepEqual(parseOmdbAwards("Won 4 Oscars. 20 wins & 24 nominations total"), {
      major: "oscar",
      majorWon: 4,
      majorNominated: 0,
      wins: 20,
      nominations: 24,
    });
  });

  it("reads a nominated head", () => {
    const summary = parseOmdbAwards("Nominated for 2 Oscars. 12 wins & 19 nominations total");
    assert.equal(summary?.major, "oscar");
    assert.equal(summary?.majorWon, 0);
    assert.equal(summary?.majorNominated, 2);
  });

  it("knows Emmys, Globes and the BAFTA variants", () => {
    assert.equal(parseOmdbAwards("Won 1 Primetime Emmy. 3 wins & 10 nominations total")?.major, "emmy");
    assert.equal(parseOmdbAwards("Nominated for 1 Golden Globe. 2 wins & 5 nominations total")?.major, "globe");
    assert.equal(parseOmdbAwards("Won 2 BAFTA Awards. 4 wins & 9 nominations total")?.major, "bafta");
    assert.equal(parseOmdbAwards("Nominated for 3 BAFTA Film Awards. 1 win & 7 nominations total")?.major, "bafta");
  });

  it("handles sentences without a major award, N/A and junk", () => {
    assert.deepEqual(parseOmdbAwards("5 wins & 2 nominations"), {
      major: null,
      majorWon: 0,
      majorNominated: 0,
      wins: 5,
      nominations: 2,
    });
    assert.equal(parseOmdbAwards("N/A"), null);
    assert.equal(parseOmdbAwards(""), null);
    assert.equal(parseOmdbAwards(null), null);
    assert.equal(parseOmdbAwards("Lorem ipsum"), null);
  });
});

describe("awards/awardChipLabel", () => {
  it("prefers the major award won", () => {
    assert.equal(awardChipLabel("Won 2 Oscars. 23 wins & 12 nominations total."), "2 Óscar");
    assert.equal(awardChipLabel("Won 1 Oscar. 2 wins & 3 nominations total"), "1 Óscar");
    assert.equal(awardChipLabel("Won 8 Primetime Emmys. 20 wins & 60 nominations total"), "8 Emmy");
    assert.equal(awardChipLabel("Won 1 Golden Globe. 4 wins & 9 nominations total"), "Globo de Oro");
    assert.equal(awardChipLabel("Won 2 Golden Globes. 4 wins & 9 nominations total"), "2 Globos de Oro");
    assert.equal(awardChipLabel("Won 3 BAFTA Film Awards. 9 wins & 20 nominations total"), "3 BAFTA");
  });

  it("falls back to nominations, then to generic wins", () => {
    assert.equal(awardChipLabel("Nominated for 1 Oscar. 4 wins & 12 nominations total"), "Nominada al Óscar");
    assert.equal(awardChipLabel("Nominated for 5 Oscars. 4 wins & 12 nominations total"), "5 nom. al Óscar");
    assert.equal(awardChipLabel("Nominated for 2 Primetime Emmys. 1 win & 6 nominations total"), "2 nom. al Emmy");
    assert.equal(awardChipLabel("7 wins & 11 nominations"), "7 premios");
    assert.equal(awardChipLabel("2 wins & 11 nominations"), null);
    assert.equal(awardChipLabel("N/A"), null);
  });
});
