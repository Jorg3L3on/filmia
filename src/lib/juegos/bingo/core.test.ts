import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assignBingo,
  BINGO_SIZE,
  BINGO_SQUARES,
  bingoCardOf,
  completeLines,
  daysLeftInMonth,
  nearestLine,
  tallyBingo,
  type BingoFilm,
  type BingoSquareDef,
} from "@/lib/juegos/bingo/core";

const film = (over: Partial<BingoFilm> = {}): BingoFilm => ({
  catalogId: over.catalogId ?? "f",
  kind: "MOVIE",
  year: 2015,
  runtimeMinutes: 110,
  originalLanguage: "en",
  genres: [],
  awards: null,
  mxReleaseDate: null,
  watchedDay: "2032-07-10",
  ...over,
});

const sq = (id: string, test: (f: BingoFilm) => boolean): BingoSquareDef => ({ id, label: id, family: "genero", test });

describe("Bingo del mes · rules (FIL-I55-2)", () => {
  it("the card is the same for a month (fixed date), nine distinct squares, varied", () => {
    const a = bingoCardOf("2032-07").map((square) => square.id);
    const b = bingoCardOf("2032-07").map((square) => square.id);
    assert.deepEqual(a, b);
    assert.equal(a.length, BINGO_SIZE);
    assert.equal(new Set(a).size, BINGO_SIZE);
    assert.notDeepEqual(bingoCardOf("2032-08").map((square) => square.id), a);
    for (const month of ["2026-11", "2026-12", "2027-01", "2032-07"]) {
      const card = bingoCardOf(month);
      const families = new Map<string, number>();
      for (const square of card) families.set(square.family, (families.get(square.family) ?? 0) + 1);
      assert.ok([...families.values()].every((count) => count <= 2), month);
      assert.ok((families.get("premios") ?? 0) <= 1, month);
    }
  });

  it("one film ticks one square at most", () => {
    const card = [sq("a", () => true), sq("b", () => true), sq("c", () => true)];
    const assignment = assignBingo(card, [film({ catalogId: "x" })]);
    assert.equal(assignment.filter((value) => value != null).length, 1);
  });

  it("the assignment maximizes ticked squares (where a greedy pick would lose one)", () => {
    // «Ana» fits A and B; «Beto» only A. Greedy in order gives Ana→A and leaves Beto out.
    const card = [sq("A", (f) => ["ana", "beto"].includes(f.catalogId)), sq("B", (f) => f.catalogId === "ana")];
    const films = [film({ catalogId: "ana" }), film({ catalogId: "beto" })];
    const assignment = assignBingo(card, films);
    assert.deepEqual(assignment, [1, 0]);
    // A bigger case: 3 squares, 3 films with a chain of choices.
    const chain = [sq("1", (f) => ["p", "q"].includes(f.catalogId)), sq("2", (f) => ["p", "r"].includes(f.catalogId)), sq("3", (f) => f.catalogId === "p")];
    const tally = tallyBingo(chain, [film({ catalogId: "p" }), film({ catalogId: "q" }), film({ catalogId: "r" })]);
    assert.equal(tally.squares, 3);
  });

  it("lines and the nearest one", () => {
    const ticked = [true, true, true, false, true, false, false, false, true];
    assert.equal(completeLines(ticked).length, 2); // top row and the diagonal 0-4-8
    const almost = [true, false, false, false, true, false, false, false, false];
    assert.deepEqual(nearestLine(almost), { line: [0, 4, 8], missing: 1 });
  });

  it("line days are when the last of its three films was logged", () => {
    const card = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((index) => sq(`s${index}`, (f) => f.catalogId === `f${index}`));
    const films = [0, 1, 2].map((index) => film({ catalogId: `f${index}`, watchedDay: `2032-07-0${index + 3}` }));
    assert.deepEqual(tallyBingo(card, films).lineDays, ["2032-07-05"]);
  });

  it("squares read Catalog facts", () => {
    const byId = new Map(BINGO_SQUARES.map((square) => [square.id, square]));
    assert.equal(byId.get("oscar")!.test(film({ awards: "Won 2 Oscars. 23 wins & 12 nominations total." })), true);
    assert.equal(byId.get("oscar")!.test(film({ awards: "Nominated for 1 Oscar. 3 wins." })), false);
    assert.equal(byId.get("nominada")!.test(film({ awards: "Nominated for 1 Oscar. 3 wins." })), true);
    assert.equal(byId.get("cine")!.test(film({ mxReleaseDate: "2032-06-20", watchedDay: "2032-07-10" })), true);
    assert.equal(byId.get("cine")!.test(film({ mxReleaseDate: "2031-06-20", watchedDay: "2032-07-10" })), false);
    assert.equal(byId.get("larga")!.test(film({ runtimeMinutes: 151 })), true);
    assert.equal(byId.get("antes-1980")!.test(film({ year: 1979 })), true);
  });

  it("days left in the month", () => {
    assert.equal(daysLeftInMonth("2026-11-13"), 18);
    assert.equal(daysLeftInMonth("2026-11-30"), 1);
  });
});
