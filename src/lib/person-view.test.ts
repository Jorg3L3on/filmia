import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { FilmographyEntry } from "./person-filmography";
import {
  essentialPicks,
  monthYearLabel,
  nextForYou,
  personLifeLine,
  recorridoTitle,
  thirdStat,
  watchedStrip,
  groupByDecade,
  mineSplit,
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
      item === club ? facts({ imdbRating: 8.8, watched: { rating: 4.5, on: "2025-03-12" } }) : factsOf(item),
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

describe("mineSplit", () => {
  it("keeps what is on your platforms and counts what is still being checked or unknown", () => {
    const answers: Record<number, SearchResultFacts | null> = {
      550: facts({ onMine: true, minePlatform: "NETFLIX" }),
      807: facts({ onMine: false }),
      37799: facts({ onMine: null, providersPending: true }),
      1949: facts({ onMine: null }),
      614560: null,
      67744: facts({ onMine: true, minePlatform: "MAX" }),
    };
    const split = mineSplit(work, (item) => answers[item.tmdbId] ?? null);
    assert.deepEqual(split.shown.map((item) => item.name), ["MINDHUNTER", "El Club de la Pelea"]);
    assert.equal(split.checking, 2);
    assert.equal(split.unknown, 1);
  });
});

// FIL-I45-1 · «Tu recorrido» (Ridley Scott in the demo account: 2 of 40 watched, Gladiador and Alien).
describe("recorridoTitle", () => {
  it("speaks by share, gender-neutral", () => {
    assert.equal(recorridoTitle(0, 40), "Aún no has visto nada suyo");
    assert.equal(recorridoTitle(2, 40), "Apenas empiezas con su obra");
    assert.equal(recorridoTitle(10, 40), "Le vas tomando el hilo");
    assert.equal(recorridoTitle(20, 40), "Vas por la mitad");
    assert.equal(recorridoTitle(30, 40), "Llevas la mayor parte");
    assert.equal(recorridoTitle(36, 40), "Casi completo");
    assert.equal(recorridoTitle(40, 40), "Viste toda su obra");
    assert.equal(recorridoTitle(0, 0), "Aún no has visto nada suyo");
  });
});

describe("watchedStrip", () => {
  const gladiador = entry(98, "Gladiador", 2000, 19000);
  const alien = entry(348, "Alien", 1979, 15000);
  const blade = entry(78, "Blade Runner", 1982, 14000);
  const marciano = entry(286217, "Misión rescate", 2015, 21000);
  const prometeo = entry(70981, "Prometeo", 2012, 11000);
  const duelistas = entry(19067, "Los duelistas", 1977, 900);
  const scott = [marciano, prometeo, gladiador, blade, alien, duelistas];
  const status = (item: FilmographyEntry) =>
    item === gladiador || item === alien ? ("watched" as const) : item === blade ? ("watchlist" as const) : null;
  const seen = (item: FilmographyEntry) =>
    item === gladiador
      ? { watched: { rating: 4.5, on: "2025-03-12" } }
      : item === alien
        ? { watched: { rating: 4, on: "2024-08-01" } }
        : null;

  it("puts watched first (latest first), then Quiero ver, then the best known", () => {
    const strip = watchedStrip(scott, status, seen, 5);
    assert.deepEqual(
      strip.frames.map((frame) => [frame.entry.name, frame.state, frame.rating, frame.on]),
      [
        ["Gladiador", "watched", 4.5, "2025-03-12"],
        ["Alien", "watched", 4, "2024-08-01"],
        ["Blade Runner", "watchlist", null, null],
        ["Misión rescate", "unseen", null, null],
        ["Prometeo", "unseen", null, null],
      ],
    );
    assert.equal(strip.more, 1);
    assert.equal(strip.last?.entry, gladiador);
    assert.deepEqual(strip.watched.map((frame) => frame.entry), [gladiador, alien]);
  });

  it("puts an undated watch after the dated ones and has no «última» without dates", () => {
    const strip = watchedStrip(scott, status, (item) => (item === gladiador ? { watched: { rating: null, on: null } } : seen(item)), 2);
    assert.deepEqual(strip.frames.map((frame) => frame.entry), [alien, gladiador]);
    const undated = watchedStrip(scott, status, (item) => (status(item) === "watched" ? { watched: { rating: null, on: null } } : null));
    assert.equal(undated.last, null);
  });

  it("is all «unseen» with nothing watched", () => {
    const strip = watchedStrip(scott, () => null, () => null, 3);
    assert.deepEqual(strip.frames.map((frame) => frame.state), ["unseen", "unseen", "unseen"]);
    assert.equal(strip.watched.length, 0);
    assert.equal(strip.more, 3);
  });

  it("labels the strip date as «mar 2025»", () => {
    assert.equal(monthYearLabel("2025-03-12"), "mar 2025");
    assert.equal(monthYearLabel(null), null);
  });

  it("«Siguiente para ti»: taste first, then «Lo esencial», never a watched one", () => {
    const taste = { level: "alta" as const, entries: [marciano, prometeo] };
    assert.deepEqual(nextForYou(taste, [gladiador, blade], status), { entry: marciano, source: "taste" });
    assert.deepEqual(nextForYou(null, [gladiador, blade], status), { entry: blade, source: "essential" });
    assert.equal(nextForYou(null, [gladiador, alien], status), null);
  });
});

describe("thirdStat", () => {
  it("shows the person's own Óscar: won, else nominations, else nothing", () => {
    assert.deepEqual(thirdStat({ wins: [1, 2], nominations: 16 }), { value: 2, label: "Óscar", tone: "gold" });
    assert.deepEqual(thirdStat({ wins: [], nominations: 4 }), { value: 4, label: "nom. al Óscar", tone: "gold" });
    assert.equal(thirdStat(null), null);
  });
});

describe("personLifeLine", () => {
  it("joins what TMDB has", () => {
    assert.equal(
      personLifeLine({ birthday: "1937-11-30", placeOfBirth: "South Shields, County Durham, England, UK" }),
      "n. 1937 · South Shields",
    );
    assert.equal(personLifeLine({ birthday: "1930-05-31", deathday: "2024-02-02", placeOfBirth: null }), "n. 1930 · † 2024");
    assert.equal(personLifeLine({}), null);
  });
});
