import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  defaultTopYear,
  parseTopYear,
  rankYearTop,
  voteFloorFor,
  yearTopError,
  yourTopLabel,
  type YearTopPick,
} from "./cine-top";

describe("rankYearTop", () => {
  it("ranks by IMDb rating over the vote floor, ties to the most voted, ten at most", () => {
    const candidates = [
      { catalogId: "low-votes", imdbRating: 9.1, imdbVotes: 3_000 },
      { catalogId: "no-rating", imdbRating: null, imdbVotes: 80_000 },
      { catalogId: "b", imdbRating: 8.2, imdbVotes: 40_000 },
      { catalogId: "a", imdbRating: 8.2, imdbVotes: 90_000 },
      ...Array.from({ length: 12 }, (_, index) => ({ catalogId: `f${index}`, imdbRating: 7 - index / 10, imdbVotes: 30_000 })),
    ];
    const ranked = rankYearTop(candidates, 25_000);
    assert.equal(ranked.length, 10);
    assert.deepEqual(ranked.slice(0, 3).map((entry) => [entry.rank, entry.catalogId]), [[1, "a"], [2, "b"], [3, "f0"]]);
    assert.ok(!ranked.some((entry) => entry.catalogId === "low-votes" || entry.catalogId === "no-rating"));
  });

  it("lowers the floor for the year in progress until June", () => {
    assert.equal(voteFloorFor(2026, "2026-04-10"), 10_000);
    assert.equal(voteFloorFor(2026, "2026-10-17"), 25_000);
    assert.equal(voteFloorFor(2025, "2026-04-10"), 25_000);
  });
});

describe("top year", () => {
  it("opens on last year until March", () => {
    assert.equal(defaultTopYear("2026-02-10"), 2025);
    assert.equal(defaultTopYear("2026-10-17"), 2026);
  });

  it("parses ?anio= within the offered range", () => {
    assert.equal(parseTopYear("2024", "2026-10-17"), 2024);
    assert.equal(parseTopYear("2031", "2026-10-17"), 2026);
    assert.equal(parseTopYear("abc", "2026-10-17"), 2026);
  });

  it("names a short top by its size", () => {
    assert.equal(yourTopLabel(2025, 6), "Tu top 6 de 2025");
    assert.equal(yourTopLabel(2026, 0), "Tu top 10 de 2026");
    assert.equal(yourTopLabel(2026, 10), "Tu top 10 de 2026");
  });
});

describe("yearTopError", () => {
  const picks: YearTopPick[] = [
    { titleId: "seen-2026", watched: true, year: 2026, kind: "MOVIE" },
    { titleId: "unseen-2026", watched: false, year: 2026, kind: "MOVIE" },
    { titleId: "seen-2025", watched: true, year: 2025, kind: "MOVIE" },
    { titleId: "series-2026", watched: true, year: 2026, kind: "SERIES" },
  ];

  it("accepts movies of that year you saw", () => {
    assert.equal(yearTopError(2026, ["seen-2026"], picks), null);
    assert.equal(yearTopError(2026, [], picks), null);
  });

  it("rejects unseen, other years, series, repeats, strangers and an eleventh", () => {
    assert.match(yearTopError(2026, ["unseen-2026"], picks) ?? "", /ya viste/);
    assert.match(yearTopError(2026, ["seen-2025"], picks) ?? "", /2026/);
    assert.match(yearTopError(2026, ["series-2026"], picks) ?? "", /películas/);
    assert.match(yearTopError(2026, ["seen-2026", "seen-2026"], picks) ?? "", /una vez/);
    assert.match(yearTopError(2026, ["someone-else"], picks) ?? "", /no encontrada/);
    assert.match(yearTopError(2026, Array.from({ length: 11 }, (_, i) => `x${i}`), picks) ?? "", /10 lugares/);
  });
});
