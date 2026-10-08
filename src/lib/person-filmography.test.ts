import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildPersonSearchHref,
  parseFilmography,
  personNameMatchesQuery,
  personRoleLine,
  personYearsLabel,
  resolveDirectorQuery,
  summarizeFilmography,
  type TmdbCombinedCredits,
} from "./person-filmography";

const movie = (id: number, title: string, date: string, extra: object = {}) => ({
  id,
  media_type: "movie",
  title,
  original_title: title,
  release_date: date,
  poster_path: `/${id}.jpg`,
  ...extra,
});

const tv = (id: number, name: string, date: string, extra: object = {}) => ({
  id,
  media_type: "tv",
  name,
  original_name: name,
  first_air_date: date,
  poster_path: null,
  ...extra,
});

const credits: TmdbCombinedCredits = {
  cast: [
    movie(1, "Midsommar", "2019-07-03", { character: "Dani" }),
    tv(2, "Hot Ones", "2015-03-12", { character: "Self", episode_count: 1 }),
    tv(3, "Jimmy Kimmel Live!", "2003-01-26", { character: "Self - Guest", episode_count: 4 }),
    tv(4, "Hawkeye", "2021-11-24", { character: "Yelena Belova", episode_count: 3 }),
    tv(5, "Cameo Show", "2020-01-01", { character: "Barista", episode_count: 1 }),
    movie(6, "Oppenheimer", "2023-07-19", { character: "" }),
    movie(6, "Oppenheimer", "2023-07-19", { character: "Jean Tatlock" }),
    movie(7, "Untitled", "", { character: "Lead" }),
    movie(8, "Adult thing", "2010-01-01", { character: "X", adult: true }),
  ],
  crew: [
    movie(10, "Se7en", "1995-09-22", { job: "Director" }),
    movie(11, "Fight Club", "1999-10-15", { job: "Director" }),
    movie(11, "Fight Club", "1999-10-15", { job: "Executive Producer" }),
    movie(12, "Mank", "2020-11-13", { job: "Director" }),
    movie(13, "Zodiac", "2007-03-02", { job: "Thanks" }),
    tv(14, "MINDHUNTER", "2017-10-13", { job: "Director", episode_count: 7 }),
    tv(14, "MINDHUNTER", "2017-10-13", { job: "Executive Producer", episode_count: 19 }),
    tv(15, "The Hire", "2001-04-26", { job: "Creator" }),
    movie(16, "Blade Runner 2049", "2017-10-04", { job: "Director of Photography" }),
    movie(17, "Fargo", "1996-03-08", { job: "Director of Photography" }),
    movie(18, "Fargo", "1996-03-08", { job: "Creator" }),
  ],
};

describe("parseFilmography", () => {
  it("director: film Director credits plus series directed or created, newest first, deduped", () => {
    const entries = parseFilmography(credits, "director");
    assert.deepEqual(
      entries.map((entry) => `${entry.kind}:${entry.name}`),
      [
        "MOVIE:Mank",
        "SERIES:MINDHUNTER",
        "SERIES:The Hire",
        "MOVIE:Fight Club",
        "MOVIE:Se7en",
      ],
    );
    assert.equal(entries[0]?.year, 2020);
    assert.equal(entries[0]?.posterPath, "/12.jpg");
  });

  it("reparto: keeps characters, drops «Self» appearances, one-episode cameos and adult titles", () => {
    const entries = parseFilmography(credits, "reparto");
    assert.deepEqual(
      entries.map((entry) => [entry.name, entry.character]),
      [
        ["Oppenheimer", "Jean Tatlock"],
        ["Hawkeye", "Yelena Belova"],
        ["Midsommar", "Dani"],
        ["Untitled", "Lead"],
      ],
    );
    assert.equal(entries.at(-1)?.date, null, "undated credits go last");
  });

  it("fotografia: only Director of Photography", () => {
    const entries = parseFilmography(credits, "fotografia");
    assert.deepEqual(
      entries.map((entry) => entry.name),
      ["Blade Runner 2049", "Fargo"],
    );
  });

  it("tolerates missing payloads", () => {
    assert.deepEqual(parseFilmography(null, "director"), []);
    assert.deepEqual(parseFilmography({}, "reparto"), []);
  });
});

describe("person summary copy", () => {
  const person = { id: 7467, name: "David Fincher", profilePath: null, department: "Directing" };

  it("counts films and series and the active years", () => {
    const summary = summarizeFilmography(person, "director", parseFilmography(credits, "director"));
    assert.equal(summary.movies, 3);
    assert.equal(summary.series, 2);
    assert.deepEqual(summary.years, { from: 1995, to: 2020 });
    assert.equal(personRoleLine(summary), "Director · 3 películas · 2 series");
    assert.equal(personYearsLabel(summary.years), "1995–2020");
  });

  it("words the other roles by titles", () => {
    assert.equal(personRoleLine({ role: "reparto", movies: 1, series: 0 }), "Reparto · 1 título");
    assert.equal(
      personRoleLine({ role: "fotografia", movies: 30, series: 2 }),
      "Dirección de fotografía · 32 títulos",
    );
    assert.equal(personRoleLine({ role: "director", movies: 1, series: 0 }), "Director · 1 película");
    assert.equal(personYearsLabel({ from: 2001, to: 2001 }), "2001");
    assert.equal(personYearsLabel(null), null);
  });
});

describe("personNameMatchesQuery", () => {
  it("matches full names and the surname alone, without accents or case", () => {
    assert.equal(personNameMatchesQuery("David Fincher", "david fincher"), true);
    assert.equal(personNameMatchesQuery("David Fincher", "  FINCHER "), true);
    assert.equal(personNameMatchesQuery("Alejandro González Iñárritu", "gonzalez inarritu"), true);
    assert.equal(personNameMatchesQuery("Pedro Almodóvar", "almodovar"), true);
  });

  it("rejects first names alone, typos and extra words", () => {
    assert.equal(personNameMatchesQuery("David Fincher", "david"), false);
    assert.equal(personNameMatchesQuery("David Fincher", "fincer"), false);
    assert.equal(personNameMatchesQuery("David Fincher", "david fincher movies"), false);
    assert.equal(personNameMatchesQuery("David Fincher", ""), false);
  });
});

describe("resolveDirectorQuery", () => {
  const hit = (id: number, name: string) => ({ id, name, profilePath: null, popularity: 1 });

  it("opens the person when exactly one name matches", () => {
    const result = resolveDirectorQuery([hit(1, "David Fincher"), hit(2, "Davida Fincherson")], "david fincher");
    assert.equal(result.kind, "person");
    assert.equal(result.kind === "person" ? result.hit.id : null, 1);
  });

  it("asks to choose when several match, or none match by name", () => {
    const ambiguous = resolveDirectorQuery(
      [hit(1, "Wes Anderson"), hit(2, "Paul Thomas Anderson"), hit(3, "Roy Andersson")],
      "anderson",
    );
    assert.equal(ambiguous.kind, "choose");
    assert.deepEqual(ambiguous.kind === "choose" ? ambiguous.hits.map((h) => h.id) : [], [1, 2]);
    const loose = resolveDirectorQuery([hit(1, "David Fincher")], "fincer");
    assert.equal(loose.kind, "choose");
  });

  it("is empty with no directors", () => {
    assert.equal(resolveDirectorQuery([], "zzz").kind, "none");
  });
});

describe("buildPersonSearchHref", () => {
  it("keeps the query and mode for back/forward and encodes the name", () => {
    assert.equal(
      buildPersonSearchHref({ personId: 7467, role: "director", name: "David Fincher", query: "fincher", mode: "director" }),
      "/buscar?q=fincher&tipo=director&persona=7467&rol=director&nombre=David+Fincher",
    );
    assert.equal(
      buildPersonSearchHref({ personId: 1, role: "reparto" }),
      "/buscar?persona=1&rol=reparto",
    );
  });
});
