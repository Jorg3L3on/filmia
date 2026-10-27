import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { FilmographyEntry } from "./person-filmography";
import {
  essentialPicks,
  groupByDecade,
  releaseDateLabel,
  shelvesSettled,
  tastePicks,
  upcomingSummary,
  watchProgress,
} from "./person-view";
import { PENDING_FACTS, type SearchResultFacts } from "./search-result-facts";

const entry = (tmdbId: number, name: string, year: number | null, votes = 100): FilmographyEntry => ({
  tmdbId,
  kind: "MOVIE",
  name,
  originalName: null,
  year,
  posterPath: null,
  backdropPath: null,
  overview: null,
  character: null,
  date: year ? `${year}-06-01` : null,
  votes,
  aside: null,
});

const facts = (patch: Partial<SearchResultFacts>): SearchResultFacts => ({ ...PENDING_FACTS, pending: false, ...patch });
const podria = { level: "media" as const, label: "Podría gustarte", lowConfidence: true };
const fuera = { level: "baja" as const, label: "Fuera de tu zona", lowConfidence: true };

// Fincher in the demo account, 2026-10-17 (real Catalog values).
const zodiaco = entry(1949, "Zodíaco", 2007, 6000);
const club = entry(550, "El Club de la Pelea", 1999, 30000);
const se7en = entry(807, "Se7en", 1995, 20000);
const red = entry(37799, "Red Social", 2010, 12000);
const mank = entry(614560, "MANK", 2020, 2000);
const mindhunter = entry(67744, "MINDHUNTER", 2017);
const work = [mank, mindhunter, red, zodiaco, club, se7en];
const byId: Record<number, SearchResultFacts> = {
  550: facts({ imdbRating: 8.8, affinity: podria }),
  807: facts({ imdbRating: 8.6, affinity: fuera }),
  37799: facts({ imdbRating: 7.8, affinity: podria }),
  1949: facts({ imdbRating: 7.7, affinity: fuera }),
  614560: facts({ imdbRating: 6.8, affinity: podria }),
};
const factsOf = (item: FilmographyEntry) => byId[item.tmdbId] ?? null;

describe("essentialPicks", () => {
  it("ranks the rated work by IMDb, up to six", () => {
    assert.deepEqual(
      essentialPicks(work, factsOf).map((item) => item.name),
      ["El Club de la Pelea", "Se7en", "Red Social", "Zodíaco", "MANK"],
    );
  });

  it("stays hidden with fewer than three ratings", () => {
    assert.deepEqual(essentialPicks(work, (item) => (item === club || item === se7en ? factsOf(item) : null)), []);
  });
});

describe("tastePicks", () => {
  it("keeps «Podría gustarte» and up, by IMDb, not watched", () => {
    const picks = tastePicks(work, factsOf);
    assert.equal(picks?.level, "media");
    assert.deepEqual(picks?.entries.map((item) => item.name), ["El Club de la Pelea", "Red Social", "MANK"]);
  });

  it("puts «Muy tu estilo» first and names the shelf after it", () => {
    const alta = { level: "alta" as const, label: "Muy tu estilo", lowConfidence: false };
    const picks = tastePicks(work, (item) => (item === mank ? facts({ imdbRating: 6.8, affinity: alta }) : factsOf(item)));
    assert.equal(picks?.level, "alta");
    assert.equal(picks?.entries[0], mank);
  });

  it("drops watched titles and is null without a taste profile", () => {
    const watched = tastePicks(work, (item) =>
      item === club ? facts({ imdbRating: 8.8, watched: { rating: 4.5 } }) : factsOf(item),
    );
    assert.deepEqual(watched?.entries.map((item) => item.name), ["Red Social", "MANK"]);
    assert.equal(tastePicks(work, (item) => facts({ imdbRating: factsOf(item)?.imdbRating ?? null })), null);
  });
});

describe("watchProgress", () => {
  it("counts watched and Quiero ver over the work", () => {
    const progress = watchProgress(work, (item) => (item === club ? "watched" : item === red ? "watchlist" : null));
    assert.deepEqual(
      { total: progress.total, watched: progress.watched, watchlist: progress.watchlist },
      { total: 6, watched: 1, watchlist: 1 },
    );
    assert.equal(progress.marks[4], "watched");
  });
});

describe("groupByDecade", () => {
  it("groups newest first and skips undated", () => {
    assert.deepEqual(
      groupByDecade([...work, entry(9, "Sin año", null)]).map((group) => [group.label, group.entries.length]),
      [["2020s", 1], ["2010s", 2], ["2000s", 1], ["1990s", 2]],
    );
  });
});

describe("upcoming", () => {
  const today = "2026-10-17";
  it("labels dates in Spanish, with the year only when it is not this one", () => {
    assert.equal(releaseDateLabel("2026-11-25", today), "25 nov");
    assert.equal(releaseDateLabel("2027-03-25", today), "25 mar 2027");
  });

  it("names the next release and what follows", () => {
    const cliff = { ...entry(1, "Cliff Booth", 2026), date: "2026-11-25" };
    const bitter = entry(2, "Bitterroot", null);
    assert.deepEqual(
      (({ when, more }) => ({ when, more }))(upcomingSummary([cliff, bitter], today)!),
      { when: "25 nov", more: "y 1 sin fecha" },
    );
    assert.equal(upcomingSummary([cliff, { ...cliff, tmdbId: 3 }, bitter], today)?.more, "y 2 más");
    assert.equal(upcomingSummary([], today), null);
    assert.equal(upcomingSummary([bitter], today)?.when, "Sin fecha");
  });
});

describe("shelvesSettled", () => {
  it("waits while any title is unanswered or still filling", () => {
    assert.equal(shelvesSettled(work, factsOf), false);
    assert.equal(shelvesSettled(work, (item) => (item === mindhunter ? PENDING_FACTS : facts({}))), false);
  });

  it("settles once every title has its final answer", () => {
    assert.equal(shelvesSettled(work, (item) => factsOf(item) ?? facts({})), true);
  });

  it("only counts the best-known titles the view asks about", () => {
    // MINDHUNTER has the fewest votes: past the limit it is never asked about.
    assert.equal(shelvesSettled(work, factsOf, work.length - 1), true);
  });
});
