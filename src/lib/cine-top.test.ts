import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  defaultTopYear,
  IMDB_YEAR_TOP_SIZE,
  olderTopYears,
  parseTopYear,
  pendingTopDay,
  pendingTopDayLabel,
  planOmdbCalls,
  rankYearTop,
  startTopLabel,
  voteFloorFor,
  watchedOfYearCopy,
  yearTopError,
  yourTopLabel,
  type YearTopPick,
} from "./cine-top";

describe("rankYearTop", () => {
  it("ranks by IMDb rating over the vote floor, ties to the most voted", () => {
    const candidates = [
      { catalogId: "low-votes", imdbRating: 9.1, imdbVotes: 3_000 },
      { catalogId: "no-rating", imdbRating: null, imdbVotes: 80_000 },
      { catalogId: "b", imdbRating: 8.2, imdbVotes: 40_000 },
      { catalogId: "a", imdbRating: 8.2, imdbVotes: 90_000 },
      ...Array.from({ length: 12 }, (_, index) => ({ catalogId: `f${index}`, imdbRating: 7 - index / 10, imdbVotes: 30_000 })),
    ];
    const ranked = rankYearTop(candidates, 25_000);
    assert.equal(ranked.length, 14);
    assert.deepEqual(ranked.slice(0, 3).map((entry) => [entry.rank, entry.catalogId]), [[1, "a"], [2, "b"], [3, "f0"]]);
    assert.ok(!ranked.some((entry) => entry.catalogId === "low-votes" || entry.catalogId === "no-rating"));
  });

  it("keeps a hundred at most (FIL-I32)", () => {
    const candidates = Array.from({ length: 140 }, (_, index) => ({
      catalogId: `f${index}`,
      imdbRating: 9 - index / 100,
      imdbVotes: 50_000,
    }));
    const ranked = rankYearTop(candidates, 25_000);
    assert.equal(ranked.length, IMDB_YEAR_TOP_SIZE);
    assert.deepEqual([ranked[0].catalogId, ranked[99].catalogId, ranked[99].rank], ["f0", "f99", 100]);
  });

  it("lowers the floor for the year in progress until June", () => {
    assert.equal(voteFloorFor(2026, "2026-04-10"), 10_000);
    assert.equal(voteFloorFor(2026, "2026-10-17"), 25_000);
    assert.equal(voteFloorFor(2025, "2026-04-10"), 25_000);
  });
});

describe("planOmdbCalls", () => {
  const row = (id: string, scored: boolean) => ({ id, imdbRating: scored ? 7.5 : null, imdbVotes: scored ? 40_000 : null });
  const rows = [row("s1", true), row("u1", false), row("s2", true), row("u2", false), row("u3", false), row("s3", true)];

  it("asks about unscored films first, then refreshes stored scores, within the budget", () => {
    const plan = planOmdbCalls(rows, 5, 10);
    assert.deepEqual(plan.ask.map((entry) => entry.id), ["u1", "u2", "u3", "s1", "s2"]);
    assert.equal(plan.skipped, 0);
  });

  it("caps the refreshes and spends nothing on them in older years", () => {
    assert.deepEqual(planOmdbCalls(rows, 50, 1).ask.map((entry) => entry.id), ["u1", "u2", "u3", "s1"]);
    assert.deepEqual(planOmdbCalls(rows, 50, 0).ask.map((entry) => entry.id), ["u1", "u2", "u3"]);
  });

  it("counts the unscored films a short budget leaves for the next run", () => {
    const plan = planOmdbCalls(rows, 2, 10);
    assert.deepEqual(plan.ask.map((entry) => entry.id), ["u1", "u2"]);
    assert.equal(plan.skipped, 1);
    assert.deepEqual(planOmdbCalls(rows, 0, 10), { ask: [], skipped: 3 });
    assert.equal(planOmdbCalls(rows, -4, 10).skipped, 3);
  });
});

describe("olderTopYears", () => {
  it("orders years with no top, then pre-FIL-I32 tens, newest first; full tops are left alone", () => {
    const sizes = new Map([
      [2024, 10],
      [2023, 100],
      [2022, 87],
      [2020, 10],
      [2018, 100],
      [2017, 100],
      [2016, 100],
      [2015, 100],
    ]);
    assert.deepEqual(olderTopYears(sizes, "2026-10-28"), [2021, 2019, 2024, 2020]);
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

  it("counts what you saw in singular or plural and nudges until three (FIL-I23-1)", () => {
    assert.equal(watchedOfYearCopy(2024, 1), "Has visto 1 película de 2024. Con 3 ya hay top.");
    assert.equal(watchedOfYearCopy(2024, 2), "Has visto 2 películas de 2024. Ordénalas a tu gusto.");
    assert.equal(watchedOfYearCopy(2024, 7), "Has visto 7 películas de 2024. Ordénalas a tu gusto.");
    assert.equal(startTopLabel(1), "Empezar mi top");
    assert.equal(startTopLabel(2), "Empezar mi top");
    assert.equal(startTopLabel(3), "Armar mi top");
  });

  it("dates a pending older top by the missing years ahead of it, one a night", () => {
    const today = "2026-10-21";
    assert.equal(pendingTopDay(2024, [2026, 2025], today), "2026-10-22");
    assert.equal(pendingTopDay(2018, [2026, 2025, 2024, 2020], today), "2026-10-26");
    assert.equal(pendingTopDayLabel(2024, [2026, 2025], today), "mañana");
    assert.equal(pendingTopDayLabel(2018, [2026, 2025, 2024, 2020], today), "el lun 26 oct");
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
