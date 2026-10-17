import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addDays,
  groupByWeek,
  isGone,
  isPremiereWeek,
  judgeCinemaCandidate,
  mxToday,
  releaseStatusOn,
  staleLabel,
  ticketStub,
  weekStart,
  type CinemaCandidate,
} from "./cine-core";

const candidate = (overrides: Partial<CinemaCandidate> = {}): CinemaCandidate => ({
  tmdbId: 1,
  popularity: 20,
  originalLanguage: "en",
  productionCountries: ["US"],
  releaseDate: "2026-10-10",
  mxReleaseDates: [{ type: 3, release_date: "2026-10-23T00:00:00.000Z" }],
  ...overrides,
});

describe("judgeCinemaCandidate", () => {
  it("keeps La venganza del Charro Negro (popularity 2.6, Spanish, Mexican) and ignores its Morelia date", () => {
    const verdict = judgeCinemaCandidate(
      candidate({
        tmdbId: 1406492,
        popularity: 2.6127,
        originalLanguage: "es",
        productionCountries: ["MX"],
        releaseDate: "2026-10-22",
        mxReleaseDates: [
          { type: 1, release_date: "2026-10-18T00:00:00.000Z", note: "Morelia International Film Festival" },
          { type: 3, release_date: "2026-10-22T00:00:00.000Z" },
        ],
      }),
    );
    assert.deepEqual(verdict, { ok: true, mxReleaseDate: "2026-10-22" });
  });

  it("keeps Wildwood on its commercial date (Oct 29), not the festival one (Oct 23)", () => {
    const verdict = judgeCinemaCandidate(
      candidate({
        tmdbId: 791523,
        popularity: 15.8,
        releaseDate: "2026-10-19",
        mxReleaseDates: [
          { type: 1, release_date: "2026-10-23T00:00:00.000Z", note: "Morelia" },
          { type: 3, release_date: "2026-10-29T00:00:00.000Z" },
        ],
      }),
    );
    assert.deepEqual(verdict, { ok: true, mxReleaseDate: "2026-10-29" });
  });

  it("drops a re-release (original over a year before the MX date)", () => {
    const verdict = judgeCinemaCandidate(
      candidate({
        releaseDate: "1997-12-19",
        mxReleaseDates: [
          { type: 3, release_date: "1998-01-16T00:00:00.000Z" },
          { type: 3, release_date: "2026-10-30T00:00:00.000Z", note: "Reestreno" },
        ],
      }),
    );
    assert.deepEqual(verdict, { ok: false, reason: "rerelease" });
  });

  it("drops a film with only limited (type 2) MX dates", () => {
    const verdict = judgeCinemaCandidate(
      candidate({ mxReleaseDates: [{ type: 2, release_date: "2026-11-05T00:00:00.000Z" }] }),
    );
    assert.deepEqual(verdict, { ok: false, reason: "no_theatrical" });
  });

  it("drops an unpopular foreign film but keeps a Spanish-language one", () => {
    assert.deepEqual(judgeCinemaCandidate(candidate({ popularity: 3 })), { ok: false, reason: "unpopular" });
    assert.equal(judgeCinemaCandidate(candidate({ popularity: 3, originalLanguage: "es", productionCountries: ["ES"] })).ok, true);
  });

  it("drops a film with no MX entry at all", () => {
    assert.deepEqual(judgeCinemaCandidate(candidate({ mxReleaseDates: [] })), { ok: false, reason: "no_theatrical" });
  });
});

describe("cine calendar", () => {
  it("uses the Mexico City day", () => {
    // 03:00 UTC on the 17th is still the 16th in Mexico City.
    assert.equal(mxToday(new Date("2026-10-17T03:00:00Z")), "2026-10-16");
    assert.equal(mxToday(new Date("2026-10-17T12:00:00Z")), "2026-10-17");
  });

  it("derives the status from the MX date", () => {
    assert.equal(releaseStatusOn("2026-10-17", "2026-10-17"), "now");
    assert.equal(releaseStatusOn("2026-10-22", "2026-10-17"), "upcoming");
  });

  it("ages rows out after three days unseen", () => {
    const now = new Date("2026-10-17T10:00:00Z");
    assert.equal(isGone(new Date("2026-10-15T10:00:00Z"), now), false);
    assert.equal(isGone(new Date("2026-10-14T10:00:00Z"), now), true);
  });

  it("tags the first week as a premiere", () => {
    assert.equal(isPremiereWeek("2026-10-16", "2026-10-17"), true);
    assert.equal(isPremiereWeek("2026-10-09", "2026-10-17"), false);
    assert.equal(isPremiereWeek("2026-10-22", "2026-10-17"), false);
  });

  it("groups by Monday-started weeks with a ticket stub", () => {
    assert.equal(weekStart("2026-10-22"), "2026-10-19");
    assert.deepEqual(ticketStub("2026-10-22"), { weekday: "JUE", day: 22 });
    const groups = groupByWeek([
      { id: "b", mxReleaseDate: "2026-10-29" },
      { id: "a", mxReleaseDate: "2026-10-22" },
      { id: "c", mxReleaseDate: "2026-10-23" },
      { id: "d", mxReleaseDate: "2026-11-05" },
    ]);
    assert.deepEqual(
      groups.map((group) => [group.week, group.month, group.items.map((item) => item.id)]),
      [
        ["2026-10-19", "octubre", ["a", "c"]],
        ["2026-10-26", "octubre", ["b"]],
        ["2026-11-02", "noviembre", ["d"]],
      ],
    );
    assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  });

  it("labels a stale cartelera only after a missed run", () => {
    const now = new Date("2026-10-17T12:00:00Z");
    assert.equal(staleLabel(new Date("2026-10-17T10:00:00Z"), now), null);
    assert.equal(staleLabel(new Date("2026-10-16T08:00:00Z"), now), "Actualizado hace 28 h");
    assert.equal(staleLabel(new Date("2026-10-14T08:00:00Z"), now), "Actualizado hace 3 días");
  });
});
