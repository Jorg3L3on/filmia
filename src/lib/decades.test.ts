import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decadeLabel, groupByDecade, type DecadeTitle } from "./decades";

const titles: DecadeTitle[] = [
  { id: "a", name: "Alien", posterPath: null, year: 1979 },
  { id: "b", name: "Blade Runner", posterPath: null, year: 1982 },
  { id: "c", name: "Heat", posterPath: null, year: 1995 },
  { id: "d", name: "Dune", posterPath: null, year: 2021 },
  { id: "e", name: "Arrival", posterPath: null, year: 2016 },
  { id: "f", name: "Sin año", posterPath: null, year: null },
  { id: "g", name: "Blade Runner 2049", posterPath: null, year: 2017 },
  { id: "h", name: "Amélie", posterPath: null, year: 2001 },
];

describe("groupByDecade (FIL-I46-4)", () => {
  it("returns, per decade, exactly the titles a year-range query returns, with the count", () => {
    const shelves = groupByDecade(titles);
    for (const shelf of shelves) {
      const direct = titles.filter((title) => title.year != null && title.year >= shelf.decade && title.year <= shelf.decade + 9);
      assert.deepEqual(new Set(shelf.titles.map((t) => t.id)), new Set(direct.map((t) => t.id)), shelf.label);
      assert.equal(shelf.titles.length, direct.length);
    }
    assert.deepEqual(shelves.map((shelf) => shelf.label), ["2020s", "2010s", "2000s", "90s", "80s", "70s"]);
    assert.deepEqual(shelves[1]?.titles.map((t) => t.id), ["g", "e"]);
  });

  it("labels decades so they never read as another century", () => {
    assert.equal(decadeLabel(1990), "90s");
    assert.equal(decadeLabel(2000), "2000s");
  });
});
