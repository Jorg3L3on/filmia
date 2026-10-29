import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseThreadPeople, personRoleFilms, rankSeeds } from "./core";
import type { TmdbCombinedCredits } from "@/lib/person-filmography";

const TODAY = "2026-10-23";

describe("seeds", () => {
  it("ranks favoritas, then rating, then the first added; never Quiero ver or series", () => {
    const base = { kind: "MOVIE" as const, watched: true, rating: null, favorite: false };
    const ranked = rankSeeds([
      { ...base, catalogId: "a", tmdbId: 1, name: "Rated 8", rating: 8, createdAt: new Date("2026-10-01") },
      { ...base, catalogId: "b", tmdbId: 2, name: "Queued", watched: false, rating: 10, createdAt: new Date("2026-09-01") },
      { ...base, catalogId: "c", tmdbId: 3, name: "Favorite", favorite: true, createdAt: new Date("2026-10-05") },
      { ...base, catalogId: "d", tmdbId: 4, name: "Series", kind: "SERIES", rating: 10, createdAt: new Date("2026-09-01") },
      { ...base, catalogId: "e", tmdbId: 5, name: "Old unrated", createdAt: new Date("2026-01-01") },
      { ...base, catalogId: "f", tmdbId: 6, name: "New unrated", createdAt: new Date("2026-10-20") },
    ]);
    assert.deepEqual(
      ranked.map((seed) => seed.name),
      ["Favorite", "Rated 8", "Old unrated", "New unrated"],
    );
  });
});

describe("a person's work in one role", () => {
  const credits: TmdbCombinedCredits & { crew: Array<Record<string, unknown>>; cast: Array<Record<string, unknown>> } = {
    crew: [
      { id: 1, media_type: "movie", job: "Director", title: "A", release_date: "2009-09-18", vote_count: 9000 },
      { id: 2, media_type: "movie", job: "Director", title: "B", release_date: "2012-03-16", vote_count: 12000 },
      { id: 2, media_type: "movie", job: "Writer", title: "B", release_date: "2012-03-16", vote_count: 12000 },
      { id: 3, media_type: "movie", job: "Director", title: "Short film", release_date: "2010-01-01", vote_count: 12 },
      { id: 4, media_type: "movie", job: "Director", title: "Doc", release_date: "2015-01-01", vote_count: 400, genre_ids: [99] },
      { id: 5, media_type: "tv", job: "Director", name: "Series", first_air_date: "2015-01-01", vote_count: 400 },
      { id: 6, media_type: "movie", job: "Director", title: "Next year", release_date: "2027-05-26", vote_count: 0 },
      { id: 7, media_type: "movie", job: "Director", title: "C", release_date: "2014-02-07", vote_count: 8000 },
    ],
    cast: [
      { id: 8, media_type: "movie", character: "Himself", title: "Making of", release_date: "2014-01-01", vote_count: 300 },
      { id: 9, media_type: "movie", character: "Cop (uncredited)", title: "Cameo", release_date: "2014-01-01", vote_count: 300 },
      { id: 10, media_type: "movie", character: "Ryland Grace", title: "PHM", release_date: "2026-03-15", vote_count: 8000 },
    ],
  };

  it("counts released films with ≥ 50 votes in the role, in release order", () => {
    assert.deepEqual(personRoleFilms(credits, "director", TODAY).map((item) => item.tmdbId), [1, 2, 7]);
    assert.deepEqual(personRoleFilms(credits, "reparto", TODAY).map((item) => item.tmdbId), [10]);
  });
});

describe("people of a film", () => {
  it("reads the stored people: crew, composer and the top of the cast only", () => {
    assert.deepEqual(
      parseThreadPeople([
        { id: 1, name: "D", role: "director" },
        { id: 2, name: "P", role: "dp" },
        { id: 3, name: "C1", role: "cast", order: 0 },
        { id: 4, name: "C9", role: "cast", order: 9 },
        { id: 5, name: "M", role: "composer" },
        { id: 6, name: "Cr", role: "creator" },
      ]).map((person) => person.name),
      ["D", "P", "C1", "M"],
    );
  });
});
