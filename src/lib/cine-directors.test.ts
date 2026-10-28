import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cineDirectorsOf, directedByLabel, shortDirectorName } from "./cine-directors";

describe("cineDirectorsOf", () => {
  it("keeps one director with the photo path", () => {
    assert.deepEqual(
      cineDirectorsOf([
        { id: 137427, name: "Denis Villeneuve", role: "director", profilePath: "/dv.jpg" },
        { id: 1, name: "Timothée Chalamet", role: "cast", profilePath: "/tc.jpg" },
      ]),
      [{ id: 137427, name: "Denis Villeneuve", profilePath: "/dv.jpg" }],
    );
  });

  it("keeps several directors in order, once each, and drops non-Latin names", () => {
    const directors = cineDirectorsOf([
      { id: 10, name: "Daniel Kwan", role: "director" },
      { id: 11, name: "Daniel Scheinert", role: "director", profilePath: null },
      { id: 10, name: "Daniel Kwan", role: "director" },
      { id: 12, name: "黒澤 明", role: "director" },
      { id: 13, name: "Ana Lily Amirpour", role: "director", profilePath: "bad-path" },
    ]);
    assert.deepEqual(
      directors.map((director) => [director.id, director.profilePath]),
      [
        [10, null],
        [11, null],
        [13, null],
      ],
    );
  });

  it("gives nothing when there is no director", () => {
    assert.deepEqual(cineDirectorsOf([{ id: 1, name: "Someone", role: "cast" }]), []);
    assert.deepEqual(cineDirectorsOf([]), []);
  });

  it("gives nothing for corrupt or empty tmdbPeople", () => {
    for (const value of [null, undefined, "x", 42, {}, [null, "x", { id: "abc", name: "A", role: "director" }, { id: 3, role: "director" }]]) {
      assert.deepEqual(cineDirectorsOf(value), []);
    }
  });
});

describe("shortDirectorName", () => {
  it("abbreviates the first name only", () => {
    assert.equal(shortDirectorName("Denis Villeneuve"), "D. Villeneuve");
    assert.equal(shortDirectorName("María Fernanda Ayala"), "M. Fernanda Ayala");
    assert.equal(shortDirectorName("álex de la Iglesia"), "Á. de la Iglesia");
    assert.equal(shortDirectorName("Kogonada"), "Kogonada");
  });
});

describe("directedByLabel", () => {
  const d = (name: string, id = name.length) => ({ id, name, profilePath: null });
  it("names one, two, or two and the rest", () => {
    assert.equal(directedByLabel([]), "");
    assert.equal(directedByLabel([d("Greta Gerwig")]), ", dirigida por Greta Gerwig");
    assert.equal(directedByLabel([d("Daniel Kwan", 1), d("Daniel Scheinert", 2)]), ", dirigida por Daniel Kwan y Daniel Scheinert");
    assert.equal(directedByLabel([d("A", 1), d("B", 2), d("C", 3), d("D", 4)]), ", dirigida por A, B y 2 más");
  });
});
