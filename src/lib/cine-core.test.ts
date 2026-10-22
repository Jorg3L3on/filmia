import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addDays,
  cinemaChipFor,
  groupByWeek,
  hasLatinLetters,
  isGone,
  isPremiereWeek,
  judgeCinemaCandidate,
  mergeRelease,
  mxToday,
  parseCarteleraOrder,
  premiereTag,
  premiereWeekStart,
  railFade,
  readableTitle,
  releaseStatusOn,
  splitCartelera,
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

  it("drops a short (FICM online) but keeps an unknown runtime", () => {
    const mexican = { originalLanguage: "es", productionCountries: ["MX"], popularity: 0 };
    assert.deepEqual(judgeCinemaCandidate(candidate({ ...mexican, runtimeMinutes: 15 })), { ok: false, reason: "short" });
    assert.equal(judgeCinemaCandidate(candidate({ ...mexican, runtimeMinutes: null })).ok, true);
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

  it("says «Hoy» on the premiere day and «Estreno» for three days after (FIL-I23-4)", () => {
    assert.equal(premiereTag("2026-10-17", "2026-10-17"), "Hoy");
    assert.equal(premiereTag("2026-10-15", "2026-10-17"), "Estreno");
    assert.equal(premiereTag("2026-10-14", "2026-10-17"), "Estreno");
    assert.equal(premiereTag("2026-10-13", "2026-10-17"), null);
    assert.equal(premiereTag("2026-10-18", "2026-10-17"), null);
  });

  it("shows the ficha chip until the film streams in MX (FIL-I23-3)", () => {
    const now = { status: "now" as const, mxReleaseDate: "2026-10-15" };
    assert.deepEqual(cinemaChipFor(now, 0), now);
    assert.equal(cinemaChipFor(now, 2), null);
    assert.equal(cinemaChipFor(null, 0), null);
  });

  it("names the rail edges that hide more", () => {
    assert.equal(railFade(0, 390, 390), "");
    assert.equal(railFade(0, 390, 900), "right");
    assert.equal(railFade(200, 390, 900), "left right");
    assert.equal(railFade(510, 390, 900), "left");
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

describe("mergeRelease", () => {
  const today = "2026-10-17";

  it("lets an IMCINE date win over TMDB and keeps it on later TMDB runs", () => {
    const tmdb = mergeRelease(null, { mxReleaseDate: "2026-11-12", source: "tmdb", popularity: 2 }, today);
    assert.equal(tmdb.status, "upcoming");
    const imcine = mergeRelease(tmdb, { mxReleaseDate: "2026-10-15", source: "imcine", popularity: 0 }, today);
    assert.deepEqual(imcine, { mxReleaseDate: "2026-10-15", source: "imcine", popularity: 2, status: "now" });
    const again = mergeRelease(imcine, { mxReleaseDate: "2026-11-12", source: "tmdb", popularity: 3.5 }, today);
    assert.deepEqual(again, { mxReleaseDate: "2026-10-15", source: "imcine", popularity: 3.5, status: "now" });
  });

  it("creates the row from IMCINE alone when TMDB never listed it", () => {
    assert.deepEqual(
      mergeRelease(null, { mxReleaseDate: "2026-10-30", source: "imcine", popularity: 0 }, today),
      { mxReleaseDate: "2026-10-30", source: "imcine", popularity: 0, status: "upcoming" },
    );
  });

  it("follows a moved TMDB date", () => {
    const moved = mergeRelease(
      { mxReleaseDate: "2026-10-16", source: "tmdb", popularity: 9 },
      { mxReleaseDate: "2026-10-30", source: "tmdb", popularity: 9 },
      today,
    );
    assert.equal(moved.mxReleaseDate, "2026-10-30");
    assert.equal(moved.status, "upcoming");
  });
});

describe("cartelera B (FIL-I23-5)", () => {
  const films = [
    { id: "wed", mxReleaseDate: "2026-10-21", popularity: 3 },
    { id: "thu", mxReleaseDate: "2026-10-15", popularity: 9 },
    { id: "old", mxReleaseDate: "2026-10-08", popularity: 50 },
    { id: "older", mxReleaseDate: "2026-09-24", popularity: 7 },
  ];

  it("opens the premiere week on the last Thursday", () => {
    assert.equal(premiereWeekStart("2026-10-21"), "2026-10-15");
    assert.equal(premiereWeekStart("2026-10-22"), "2026-10-22");
    assert.equal(premiereWeekStart("2026-10-18"), "2026-10-15");
  });

  it("splits this week from the rest, newest first or most popular first", () => {
    const recent = splitCartelera(films, "2026-10-21");
    assert.equal(recent.weekStart, "2026-10-15");
    assert.deepEqual(recent.thisWeek.map((f) => f.id), ["wed", "thu"]);
    assert.deepEqual(recent.rest.map((f) => f.id), ["old", "older"]);
    const popular = splitCartelera(films, "2026-10-21", "populares");
    assert.deepEqual(popular.rest.map((f) => f.id), ["old", "older"]);
    const popular2 = splitCartelera([...films, { id: "hit", mxReleaseDate: "2026-09-30", popularity: 80 }], "2026-10-21", "populares");
    assert.deepEqual(popular2.rest.map((f) => f.id), ["hit", "old", "older"]);
  });

  it("shows no «Esta semana» when nothing premiered in the week", () => {
    const quiet = splitCartelera(films.filter((f) => f.id === "old" || f.id === "older"), "2026-10-21");
    assert.deepEqual(quiet.thisWeek, []);
    assert.equal(quiet.rest.length, 2);
  });

  it("reads ?orden=", () => {
    assert.equal(parseCarteleraOrder("populares"), "populares");
    assert.equal(parseCarteleraOrder(["recientes", "populares"]), "populares");
    assert.equal(parseCarteleraOrder(undefined), "recientes");
  });
});

describe("readable titles (FIL-I23-6, P4)", () => {
  it("keeps a Latin name and swaps a Devanagari or kana one for the en-US title", () => {
    assert.equal(hasLatinLetters("Madre siniestra"), true);
    assert.equal(hasLatinLetters("रामायण"), false);
    assert.equal(readableTitle("Madre siniestra", "Other Mommy"), "Madre siniestra");
    assert.equal(readableTitle("रामायण", "Ramayana"), "Ramayana");
    assert.equal(readableTitle("劇場版 転生したらスライムだった件", null), "劇場版 転生したらスライムだった件");
    assert.equal(readableTitle("劇場版 転生したらスライムだった件", "転生"), "劇場版 転生したらスライムだった件");
  });
});
