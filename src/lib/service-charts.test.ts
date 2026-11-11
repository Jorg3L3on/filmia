import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { showsNovedad } from "../components/tonight/act-two/useHoyNovedad";
import {
  actTwoStamp,
  chartHeading,
  chartPlatformsFor,
  chartSourceLine,
  defaultChartKind,
  groupArrivalsByDay,
  parseChartSource,
  rankMovement,
  showsMovement,
  snapshotRows,
  type ArrivalTitle,
  type ServiceChart,
} from "./service-charts";

const chart = (platform: ServiceChart["platform"], kind: ServiceChart["kind"], count: number): ServiceChart => ({
  platform,
  kind,
  source: "popularity",
  period: "2026-11-10",
  titles: Array.from({ length: count }, (_, index) => ({
    catalogId: `${platform}-${kind}-${index}`,
    tmdbId: index + 1,
    kind,
    name: `T${index}`,
    originalName: null,
    year: 2026,
    posterPath: "/p.jpg",
    rank: index + 1,
    previousRank: null,
    weeksOnList: null,
  })),
});

describe("chart labels", () => {
  it("never calls a popularity list «Top 10»", () => {
    assert.equal(chartHeading("MAX", "popularity"), "Lo más popular en HBO Max");
    assert.ok(!chartHeading("NETFLIX", "popularity").includes("Top 10"));
    assert.ok(!chartSourceLine("PRIME", "popularity").includes("Top 10"));
  });

  it("uses «Top 10 en México» only for an official list", () => {
    assert.equal(chartHeading("NETFLIX", "official"), "Top 10 en México");
    assert.equal(chartSourceLine("NETFLIX", "official"), "Lista oficial de Netflix");
  });

  it("reads anything unknown as popularity", () => {
    assert.equal(parseChartSource("official"), "official");
    assert.equal(parseChartSource("tmdb"), "popularity");
    assert.equal(parseChartSource(null), "popularity");
  });
});

describe("snapshotRows", () => {
  it("ranks the first ten distinct titles and keeps their previous rank", () => {
    const entries = ["a", "b", "a", "c", ...Array.from({ length: 12 }, (_, i) => `x${i}`)].map((catalogId) => ({ catalogId }));
    const rows = snapshotRows(entries, new Map([["b", 1], ["c", 7]]));
    assert.equal(rows.length, 10);
    assert.deepEqual(rows.slice(0, 3), [
      { rank: 1, catalogId: "a", previousRank: null },
      { rank: 2, catalogId: "b", previousRank: 1 },
      { rank: 3, catalogId: "c", previousRank: 7 },
    ]);
    assert.deepEqual(rows.map((row) => row.rank), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("returns fewer rows when the service carries fewer titles", () => {
    assert.equal(snapshotRows([{ catalogId: "a" }, { catalogId: "b" }], new Map()).length, 2);
    assert.equal(snapshotRows([], new Map()).length, 0);
  });
});

describe("service switcher", () => {
  const charts = [chart("NETFLIX", "MOVIE", 10), chart("NETFLIX", "SERIES", 10), chart("MAX", "SERIES", 10), chart("DISNEY", "MOVIE", 0)];

  it("lists only the user's platforms that have a list, in the user's order", () => {
    assert.deepEqual(chartPlatformsFor(["MAX", "PRIME", "NETFLIX", "DISNEY"], charts), ["MAX", "NETFLIX"]);
    assert.deepEqual(chartPlatformsFor([], charts), []);
  });

  it("opens on films, or on series when the platform has no films", () => {
    assert.equal(defaultChartKind("NETFLIX", charts), "MOVIE");
    assert.equal(defaultChartKind("MAX", charts), "SERIES");
  });
});

describe("groupArrivalsByDay", () => {
  const arrival = (catalogId: string, availableSince: string): ArrivalTitle => ({
    catalogId,
    tmdbId: 1,
    kind: "MOVIE",
    name: catalogId,
    originalName: null,
    year: 2026,
    posterPath: null,
    platform: "NETFLIX",
    availableSince,
  });
  // 2026-11-10 22:00 in Mexico City.
  const now = new Date("2026-11-11T04:00:00Z");

  it("groups by Mexico City day, newest first, with HOY / AYER / weekday", () => {
    const days = groupArrivalsByDay(
      [
        arrival("old", "2026-11-06T18:00:00Z"),
        arrival("today-late", "2026-11-11T03:00:00Z"),
        arrival("today", "2026-11-10T15:00:00Z"),
        arrival("yesterday", "2026-11-09T20:00:00Z"),
      ],
      now,
    );
    assert.deepEqual(
      days.map((day) => [day.day, day.label, day.dayOfMonth, day.titles.map((title) => title.catalogId)]),
      [
        ["2026-11-10", "HOY", 10, ["today-late", "today"]],
        ["2026-11-09", "AYER", 9, ["yesterday"]],
        ["2026-11-06", "VIE", 6, ["old"]],
      ],
    );
  });

  it("is empty without arrivals", () => {
    assert.deepEqual(groupArrivalsByDay([], now), []);
  });
});

describe("rank movement", () => {
  it("matches two consecutive snapshots", () => {
    const night1 = snapshotRows(["a", "b", "c", "d"].map((catalogId) => ({ catalogId })), new Map());
    const night2 = snapshotRows(
      ["c", "a", "e", "d"].map((catalogId) => ({ catalogId })),
      new Map(night1.map((row) => [row.catalogId, row.rank])),
    );
    assert.deepEqual(
      night2.map((row) => [row.catalogId, rankMovement(row.rank, row.previousRank)]),
      [
        ["c", { kind: "up", by: 2 }],
        ["a", { kind: "down", by: 1 }],
        ["e", { kind: "new", by: 0 }],
        ["d", { kind: "same", by: 0 }],
      ],
    );
    assert.equal(showsMovement(night1), false);
    assert.equal(showsMovement(night2), true);
  });
});

describe("Hoy tab dot", () => {
  const base = [chart("NETFLIX", "MOVIE", 10), chart("MAX", "SERIES", 10)];

  it("changes with the top three or the newest arrival, not below", () => {
    const stamp = actTwoStamp(base, []);
    assert.equal(actTwoStamp([...base].reverse(), []), stamp);
    const lowerShuffle = base.map((entry) => ({ ...entry, titles: [...entry.titles.slice(0, 3), ...entry.titles.slice(3).reverse()] }));
    assert.equal(actTwoStamp(lowerShuffle, []), stamp);
    const newTop = base.map((entry, index) => (index === 0 ? { ...entry, titles: [...entry.titles].reverse() } : entry));
    assert.notEqual(actTwoStamp(newTop, []), stamp);
    assert.notEqual(actTwoStamp(base, [{ catalogId: "new-arrival" }]), stamp);
  });

  it("shows only when a seen stamp exists and moved", () => {
    assert.equal(showsNovedad(null, "x"), false);
    assert.equal(showsNovedad("x", null), false);
    assert.equal(showsNovedad("x", "x"), false);
    assert.equal(showsNovedad("x", "y"), true);
  });
});
