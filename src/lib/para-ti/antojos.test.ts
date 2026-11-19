import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ANTOJOS, ANTOJO_IDS, POOL_KINDS, antojoById, antojoForGenres, isAntojoId, moreLikeHref } from "./antojos";
import { discoverTmdbParams } from "@/lib/tmdb-discover-params";

const NOW = new Date("2026-11-17T18:00:00Z");

describe("Para ti antojos (FIL-I60-2)", () => {
  it("has exactly the eight antojos, in order", () => {
    assert.deepEqual(
      ANTOJOS.map((antojo) => antojo.id),
      ["reir", "llorar", "miedo", "adrenalina", "pensar", "reciente", "corta", "joya"],
    );
    assert.deepEqual([...ANTOJO_IDS], ANTOJOS.map((antojo) => antojo.id));
    assert.deepEqual(
      ANTOJOS.map((antojo) => antojo.label),
      ["Reír", "Llorar", "Miedo", "Adrenalina", "Pensar", "Algo reciente", "Corta", "Joya escondida"],
    );
  });

  it("gives every antojo at least one movie and one series query that builds a valid TMDB query", () => {
    for (const antojo of ANTOJOS) {
      for (const kind of POOL_KINDS) {
        const queries = antojo.queries(kind, NOW);
        assert.ok(queries.length > 0, `${antojo.id} ${kind}`);
        for (const query of queries) {
          assert.doesNotThrow(() => discoverTmdbParams({ ...query, kind }), `${antojo.id} ${kind}`);
        }
      }
    }
  });

  it("shares Hoy's ids where the meaning is the same", () => {
    assert.ok(isAntojoId("reir") && isAntojoId("pensar"));
    assert.equal(isAntojoId("tension"), false);
    assert.equal(antojoById("nada"), null);
  });

  it("keeps series to fiction (no reality, talk, news or kids)", () => {
    for (const antojo of ANTOJOS) {
      for (const query of antojo.queries("SERIES", NOW)) {
        const params = discoverTmdbParams({ ...query, kind: "SERIES" });
        assert.ok(params.with_type, antojo.id);
        for (const genre of ["10762", "10764", "10767"]) {
          assert.ok(params.without_genres?.split("|").includes(genre), `${antojo.id} without ${genre}`);
        }
      }
    }
  });

  it("«Algo reciente» is this year and the two before (Mexico City time)", () => {
    const [movie] = antojoById("reciente")!.queries("MOVIE", NOW);
    assert.equal(movie?.yearFrom, 2024);
    assert.equal(movie?.yearTo, 2026);
    // 1 Jan 2027 03:00 UTC is still 31 Dec 2026 in Mexico City.
    const [edge] = antojoById("reciente")!.queries("SERIES", new Date("2027-01-01T03:00:00Z"));
    assert.equal(edge?.yearTo, 2026);
  });

  it("«Corta» is films of 100 min or less and miniseries", () => {
    const [movie] = antojoById("corta")!.queries("MOVIE", NOW);
    assert.equal(movie?.runtimeLte, 100);
    const series = discoverTmdbParams({ ...antojoById("corta")!.queries("SERIES", NOW)[0], kind: "SERIES" });
    assert.equal(series.with_type, "2");
  });

  it("«Joya escondida» is a high average with few votes", () => {
    const [movie] = antojoById("joya")!.queries("MOVIE", NOW);
    assert.equal(movie?.voteAverageGte, 7.3);
    assert.equal(movie?.voteCountGte, 200);
    assert.equal(movie?.voteCountLte, 5000);
  });
});

describe("«Más como esto» from Hoy (FIL-I60-6)", () => {
  it("maps a card's genres to an antojo, the most telling first", () => {
    assert.equal(antojoForGenres(["Drama", "Terror"]), "miedo");
    assert.equal(antojoForGenres(["Comedia", "Drama"]), "reir");
    assert.equal(antojoForGenres(["Acción", "Ciencia ficción"]), "adrenalina");
    assert.equal(antojoForGenres(["Sci-Fi & Fantasy"]), "pensar");
    assert.equal(antojoForGenres(["Romance"]), "llorar");
    assert.equal(antojoForGenres(["Animación"]), null);
    assert.equal(moreLikeHref(["Terror"]), "/para-ti?antojo=miedo");
    assert.equal(moreLikeHref([]), "/para-ti");
  });
});
