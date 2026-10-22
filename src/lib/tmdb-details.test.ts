import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseTmdbDetails, parseTmdbRuntimeMinutes, type TmdbTvDetailsPayload } from "./tmdb-details";
import { TMDB_CAST_LIMIT } from "./tmdb-people";

const longSeries = (castSize: number): TmdbTvDetailsPayload => ({
  id: 2734,
  name: "La ley y el orden: UVE",
  original_name: "Law & Order: Special Victims Unit",
  original_language: "en",
  first_air_date: "1999-09-20",
  poster_path: "/poster.jpg",
  backdrop_path: null,
  overview: "  Detectives de la Unidad de Víctimas Especiales.  ",
  episode_run_time: [0, 43],
  genres: [
    { id: 80, name: "Crimen" },
    { id: 80, name: "Crimen" },
    { id: 18, name: "Drama" },
  ],
  keywords: { results: [{ id: 703, name: "detective" }] },
  created_by: [{ id: 1, name: "Dick Wolf", profile_path: null }],
  aggregate_credits: {
    cast: Array.from({ length: castSize }, (_, index) => ({
      id: 100 + index,
      name: `Actor ${index}`,
      profile_path: `/actor-${index}.jpg`,
      order: index,
      roles: [{ character: `Personaje ${index}`, episode_count: castSize - index }],
      total_episode_count: castSize - index,
    })),
    crew: Array.from({ length: 400 }, (_, index) => ({
      id: 50_000 + index,
      name: `Crew ${index}`,
      job: index === 0 ? "Director of Photography" : "Writer",
      jobs: [{ job: index === 0 ? "Director of Photography" : "Writer", episode_count: 1 }],
    })),
  },
});

describe("parseTmdbDetails", () => {
  it("parses a movie with credits", () => {
    const details = parseTmdbDetails({
      id: 27205,
      title: "El origen",
      original_title: "Inception",
      original_language: "en",
      release_date: "2010-07-15",
      poster_path: "/p.jpg",
      backdrop_path: "/b.jpg",
      overview: "",
      runtime: 148,
      genres: [{ id: 878, name: "Ciencia ficción" }],
      keywords: { keywords: [{ id: 1, name: "sueño" }, { id: 0, name: "inválida" }] },
      credits: {
        cast: [{ id: 6193, name: "Leonardo DiCaprio", character: "Cobb", order: 0 }],
        crew: [{ id: 525, name: "Christopher Nolan", job: "Director" }],
      },
    });

    assert.equal(details.name, "El origen");
    assert.equal(details.originalName, "Inception");
    assert.equal(details.year, 2010);
    assert.equal(details.runtimeMinutes, 148);
    assert.equal(details.overview, null);
    assert.deepEqual(details.genres, [{ id: 878, name: "Ciencia ficción" }]);
    assert.deepEqual(details.keywords, [{ id: 1, name: "sueño" }]);
    assert.deepEqual(
      details.people.map((person) => [person.name, person.role]),
      [
        ["Christopher Nolan", "director"],
        ["Leonardo DiCaprio", "cast"],
      ],
    );
  });

  it("parses a series with aggregate credits and creators", () => {
    const details = parseTmdbDetails(longSeries(12));

    assert.equal(details.name, "La ley y el orden: UVE");
    assert.equal(details.year, 1999);
    assert.equal(details.runtimeMinutes, 43);
    assert.equal(details.overview, "Detectives de la Unidad de Víctimas Especiales.");
    assert.deepEqual(details.genres.map((genre) => genre.id), [80, 18]);
    assert.deepEqual(details.keywords, [{ id: 703, name: "detective" }]);
    assert.equal(details.people.find((person) => person.role === "creator")?.name, "Dick Wolf");
    assert.equal(details.people.filter((person) => person.role === "cast").length, TMDB_CAST_LIMIT);
  });

  it("keeps the cached entry small for a series with thousands of cast credits", () => {
    const raw = longSeries(7620);
    const rawBytes = JSON.stringify(raw).length;
    const parsedBytes = JSON.stringify(parseTmdbDetails(raw)).length;

    assert.ok(rawBytes > 1_000_000, `fixture should be megabytes, got ${rawBytes}`);
    assert.ok(parsedBytes < 100_000, `parsed details should be < 100 KB, got ${parsedBytes}`);
  });
});

describe("parseTmdbRuntimeMinutes", () => {
  it("takes the movie runtime, then the episode runtime", () => {
    assert.equal(parseTmdbRuntimeMinutes({ runtime: 117 }), 117);
    assert.equal(parseTmdbRuntimeMinutes({ runtime: 0, episode_run_time: [0, 52] }), 52);
  });

  it("falls back to the last or next episode aired when episode_run_time is empty (FIL-I24-7)", () => {
    assert.equal(parseTmdbRuntimeMinutes({ episode_run_time: [], last_episode_to_air: { runtime: 48 } }), 48);
    assert.equal(parseTmdbRuntimeMinutes({ episode_run_time: [], last_episode_to_air: { runtime: null }, next_episode_to_air: { runtime: 61 } }), 61);
    assert.equal(parseTmdbRuntimeMinutes({ episode_run_time: [], last_episode_to_air: null }), null);
  });
});
