import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { groupTitlesByWatchedDay, monthUtcRange } from "./dates";
import { monthShareText } from "./share-card";
import { longestWeekStreak, monthInFilm, previousMonth, yearInFilm, YEAR_MIN_ENTRIES, type FilmEntry } from "./year-in-film";

const entry = (id: string, watchedAt: string, extra: Partial<FilmEntry> = {}): FilmEntry => ({
  id,
  name: `Título ${id}`,
  posterPath: null,
  watchedAt,
  runtimeMinutes: 120,
  kind: "MOVIE",
  rating: null,
  genres: ["Drama"],
  ...extra,
});

// Seeded diary: noon-UTC entries (how the diary stores a day) plus edge cases.
const diary: FilmEntry[] = [
  entry("a", "2026-01-05T12:00:00Z", { genres: ["Drama", "Crimen"] }),
  entry("b", "2026-01-13T12:00:00Z", { runtimeMinutes: 90, genres: ["Comedia"] }),
  entry("c", "2026-01-20T12:00:00Z", { kind: "SERIES", runtimeMinutes: 50, genres: ["Drama"] }),
  entry("d", "2026-03-02T12:00:00Z", { runtimeMinutes: null }),
  entry("e", "2026-10-31T23:30:00Z", { rating: 9, genres: ["Terror"] }),
  entry("f", "2026-10-10T12:00:00Z", { rating: 7, genres: ["Terror", "Drama"] }),
  entry("g", "2025-12-31T12:00:00Z"),
];

describe("yearInFilm (FIL-I46-5)", () => {
  const year = yearInFilm(diary, 2026);

  it("matches a direct read of the seeded diary", () => {
    const in2026 = diary.filter((item) => String(item.watchedAt).startsWith("2026-"));
    assert.equal(year.entries, in2026.length);
    assert.equal(year.films, in2026.filter((item) => item.kind === "MOVIE").length);
    assert.equal(year.hours, Math.round(in2026.reduce((sum, item) => sum + (item.runtimeMinutes ?? 0), 0) / 60));
    assert.deepEqual(year.byMonth, [3, 0, 1, 0, 0, 0, 0, 0, 0, 2, 0, 0]);
    assert.deepEqual(year.genres.slice(0, 2), [{ name: "Drama", count: 4 }, { name: "Terror", count: 2 }]);
    // Weeks of 5, 12 and 19 Jan 2026 are consecutive: the longest streak is three.
    assert.equal(year.longestWeekStreak, 3);
  });

  it("cuts months like the diary: 23:30 on the last day stays in that month", () => {
    const { start, end } = monthUtcRange("2026-10");
    const diaryOctober = diary.filter((item) => {
      const time = new Date(item.watchedAt!).getTime();
      return time >= start.getTime() && time < end.getTime();
    });
    const october = monthInFilm(diary, "2026-10");
    assert.deepEqual(october?.entries.map((item) => item.id).sort(), diaryOctober.map((item) => item.id).sort());
    assert.ok(groupTitlesByWatchedDay(diary).get("2026-10-31")?.some((item) => item.id === "e"));
    assert.equal(year.byMonth[9], 2);
  });

  it("invites below three entries and has no «Tu mes» for an empty month", () => {
    assert.ok(yearInFilm(diary.slice(0, 2), 2026).entries < YEAR_MIN_ENTRIES);
    assert.equal(monthInFilm(diary, "2026-02"), null);
    assert.equal(previousMonth("2026-11-09"), "2026-10");
    assert.equal(previousMonth("2027-01-03"), "2026-12");
  });

  it("counts week streaks across a year boundary", () => {
    assert.equal(longestWeekStreak(["2025-12-29", "2026-01-05", "2026-01-12", "2026-02-02"]), 3);
    assert.equal(longestWeekStreak([]), 0);
  });
});

describe("monthShareText (FIL-I46-5)", () => {
  it("shares only the person's own month", () => {
    const october = monthInFilm(diary, "2026-10")!;
    const text = monthShareText({ monthLabel: "octubre", count: october.entries.length, hours: october.hours, topGenre: october.topGenre, best: october.best });
    assert.equal(text, "Mi octubre en cine: 2 títulos · 4 h · sobre todo terror. La mejor: Título e ★ 4.5");
    assert.doesNotMatch(text, /@|http|De |amig/);
  });
});

import { stripOrder } from "./year-in-film";

describe("stripOrder (FIL-I46-5)", () => {
  it("lists the month like the calendar: days ascending, the calendar's order within a day", () => {
    const month = [
      { id: "late", watchedAt: "2026-10-31T12:00:00Z" },
      { id: "d9a", watchedAt: "2026-10-09T12:00:00Z" },
      { id: "d1", watchedAt: "2026-10-01T12:00:00Z" },
      { id: "d9b", watchedAt: "2026-10-09T12:00:00Z" },
    ];
    const calendar = groupTitlesByWatchedDay(month);
    const calendarOrder = [...calendar.keys()].sort().flatMap((day) => calendar.get(day)!.map((item) => item.id));
    assert.deepEqual(stripOrder(month).map((item) => item.id), calendarOrder);
    assert.deepEqual(calendarOrder, ["d1", "d9a", "d9b", "late"]);
  });
});
