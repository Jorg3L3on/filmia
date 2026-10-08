import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CAST_CAP, itemVector } from "./tonight/features";
import type { TonightTitle } from "./tonight/types";
import { parseStoredPeople } from "./tonight-store";
import {
  TMDB_CAST_LIMIT,
  parseStoredTmdbPeople,
  parseTmdbPeople,
  tmdbPeopleNeedUpgrade,
  tmdbPeopleUpgrade,
  type TmdbCreditsPayload,
} from "./tmdb-people";

const movieCredits: TmdbCreditsPayload = {
  cast: Array.from({ length: 10 }, (_, index) => ({
    id: 100 + index,
    name: `Actor ${index}`,
    order: index,
    character: index === 1 ? "  Nikki " : `Papel ${index}`,
    profile_path: index === 3 ? null : `/actor${index}.jpg`,
  })),
  crew: [
    { id: 1, name: "Curry Barker", job: "Director", profile_path: "/curry.jpg" },
    { id: 1, name: "Curry Barker", job: "Writer", profile_path: "/curry.jpg" },
    { id: 2, name: "Taylor Clemons", job: "Director of Photography", profile_path: "/taylor.jpg" },
    { id: 3, name: "Editor", job: "Editor" },
  ],
};

const seriesCredits: TmdbCreditsPayload = {
  cast: [
    { id: 201, name: "Rainn Wilson", total_episode_count: 188, roles: [{ character: "Dwight Schrute", episode_count: 188 }] },
    { id: 200, name: "Steve Carell", total_episode_count: 160, roles: [
      { character: "Michael Scott (voice)", episode_count: 1 },
      { character: "Michael Scott", episode_count: 159 },
    ], profile_path: "/steve.jpg" },
  ],
  crew: [
    { id: 300, name: "Randall Einhorn", jobs: [{ job: "Director", episode_count: 15 }, { job: "Director of Photography", episode_count: 60 }], total_episode_count: 75 },
    { id: 301, name: "Matt Sohn", jobs: [{ job: "Director of Photography", episode_count: 120 }], total_episode_count: 120 },
    { id: 302, name: "Peter Smokler", jobs: [{ job: "Director of Photography", episode_count: 20 }], total_episode_count: 20 },
    { id: 303, name: "Third DP", jobs: [{ job: "Director of Photography", episode_count: 5 }], total_episode_count: 5 },
  ],
};

/** What the parser stored before FIL-I4-2: no photos, no DP, five cast. */
const legacyParse = (credits: TmdbCreditsPayload) => {
  const people: Array<{ id: number; name: string; role: string }> = [];
  for (const member of credits.crew ?? []) {
    const jobs = member.jobs?.map((item) => item.job) ?? [member.job];
    if (jobs.includes("Director") && !people.some((p) => p.id === member.id)) {
      people.push({ id: member.id!, name: member.name!, role: "director" });
    }
  }
  const cast = [...(credits.cast ?? [])]
    .sort((a, b) => (b.total_episode_count ?? 0) - (a.total_episode_count ?? 0) || (a.order ?? 999) - (b.order ?? 999))
    .filter((member) => !people.some((p) => p.id === member.id))
    .slice(0, 5);
  for (const member of cast) {
    people.push({ id: member.id!, name: member.name!, role: "cast" });
  }
  return people;
};

const tonightTitle = (people: unknown): TonightTitle => ({
  id: "t1",
  name: "Obsesión",
  kind: "MOVIE",
  year: 2026,
  runtimeMinutes: 100,
  imdbRating: 7.8,
  imdbVotes: 1000,
  genres: [{ id: 27, name: "Terror" }],
  keywords: [],
  people: parseStoredPeople(people),
  originalLanguage: "en",
  platform: null,
  flatrate: [],
  availableOnMine: false,
  watchedAt: null,
  rating: null,
  review: null,
  seriesStatus: null,
  seriesSeason: null,
} as unknown as TonightTitle);

describe("tmdb-people/parseTmdbPeople", () => {
  it("returns director, DP and up to eight cast with photo and character (movie)", () => {
    const people = parseTmdbPeople(movieCredits, undefined);
    const director = people.find((person) => person.role === "director");
    const dp = people.find((person) => person.role === "dp");
    const cast = people.filter((person) => person.role === "cast");

    assert.deepEqual(director, { id: 1, name: "Curry Barker", role: "director", profilePath: "/curry.jpg" });
    assert.deepEqual(dp, { id: 2, name: "Taylor Clemons", role: "dp", profilePath: "/taylor.jpg" });
    assert.equal(cast.length, TMDB_CAST_LIMIT);
    assert.deepEqual(cast.map((person) => person.order), [0, 1, 2, 3, 4, 5, 6, 7]);
    assert.equal(cast[1].character, "Nikki");
    assert.equal(cast[3].profilePath, null, "no photo stays null, never a placeholder");
    assert.equal(people.filter((person) => person.id === 1).length, 1, "director listed once");
  });

  it("series: creators, character with the most episodes, DPs by episodes (max two)", () => {
    const people = parseTmdbPeople(seriesCredits, [{ id: 400, name: "Greg Daniels", profile_path: "/greg.jpg" }]);

    assert.deepEqual(people[0], { id: 400, name: "Greg Daniels", role: "creator", profilePath: "/greg.jpg" });
    const cast = people.filter((person) => person.role === "cast");
    assert.deepEqual(cast.map((person) => [person.name, person.character]), [
      ["Rainn Wilson", "Dwight Schrute"],
      ["Steve Carell", "Michael Scott"],
    ]);
    assert.equal(cast[0].profilePath, null);
    // Einhorn is already the director; the two DPs left by episodes are Sohn and Smokler.
    assert.deepEqual(
      people.filter((person) => person.role === "dp").map((person) => person.name),
      ["Matt Sohn", "Peter Smokler"],
    );
    assert.equal(people.find((person) => person.id === 300)?.role, "director");
  });

  it("empty credits give no people", () => {
    assert.deepEqual(parseTmdbPeople(undefined, undefined), []);
    assert.deepEqual(parseTmdbPeople({ cast: [{ id: 0, name: "x" }, { id: 5, name: " " }] }, []), []);
  });
});

describe("tmdb-people/stored rows", () => {
  const legacy = [
    { id: 1, name: "Curry Barker", role: "director" },
    { id: 100, name: "Actor 0", role: "cast" },
  ];

  it("old rows still read (no photo key, no character)", () => {
    assert.deepEqual(parseStoredTmdbPeople(legacy), [
      { id: 1, name: "Curry Barker", role: "director" },
      { id: 100, name: "Actor 0", role: "cast" },
    ]);
    assert.deepEqual(parseStoredPeople(legacy), legacy);
  });

  it("new rows keep photo, character and order; junk is dropped", () => {
    const stored = parseStoredTmdbPeople([
      { id: 2, name: "Taylor Clemons", role: "dp", profilePath: "/t.jpg" },
      { id: 101, name: "Actor 1", role: "cast", profilePath: null, character: "Nikki", order: 1 },
      { id: "x", name: "Bad", role: "cast" },
      { id: 9, name: "Bad role", role: "writer" },
      "nope",
    ]);
    assert.deepEqual(stored, [
      { id: 2, name: "Taylor Clemons", role: "dp", profilePath: "/t.jpg" },
      { id: 101, name: "Actor 1", role: "cast", profilePath: null, character: "Nikki", order: 1 },
    ]);
    assert.deepEqual(parseStoredTmdbPeople(null), []);
  });

  it("detects rows that need photos and the DP", () => {
    assert.equal(tmdbPeopleNeedUpgrade(legacy), true);
    assert.equal(tmdbPeopleNeedUpgrade(parseTmdbPeople(movieCredits, undefined)), false);
    assert.equal(tmdbPeopleNeedUpgrade([]), false);
    assert.equal(tmdbPeopleNeedUpgrade("junk"), false);
  });

  it("upgrades only with a non-empty fetch and only old or empty rows", () => {
    const fresh = parseTmdbPeople(movieCredits, undefined);
    assert.deepEqual(tmdbPeopleUpgrade(legacy, fresh), fresh);
    assert.deepEqual(tmdbPeopleUpgrade([], fresh), fresh);
    assert.equal(tmdbPeopleUpgrade(legacy, []), null, "never writes an empty list over stored people");
    assert.equal(tmdbPeopleUpgrade(legacy, null), null);
    assert.equal(tmdbPeopleUpgrade(fresh, fresh), null, "already upgraded");
  });
});

describe("tmdb-people/Esta noche no cambia", () => {
  it("Tonight ignores dp and the extra fields", () => {
    const people = parseStoredPeople(parseTmdbPeople(movieCredits, undefined));
    assert.equal(people.some((person) => (person.role as string) === "dp"), false);
    for (const person of people) {
      assert.deepEqual(Object.keys(person).sort(), ["id", "name", "role"]);
    }
  });

  it("the taste vector of a new row equals the one of the old row", () => {
    for (const credits of [movieCredits, seriesCredits]) {
      const before = itemVector(tonightTitle(legacyParse(credits)));
      const after = itemVector(tonightTitle(parseTmdbPeople(credits, undefined)));
      assert.deepEqual([...after.entries()].sort(), [...before.entries()].sort());
    }
  });

  it("only the first five cast count", () => {
    const vector = itemVector(tonightTitle(parseTmdbPeople(movieCredits, undefined)));
    const castKeys = [...vector.keys()].filter((key) => key.startsWith("p:10"));
    assert.equal(castKeys.length, CAST_CAP);
    assert.deepEqual(castKeys.sort(), ["p:100", "p:101", "p:102", "p:103", "p:104"]);
  });
});
