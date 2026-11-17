import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { TMDB_TV_TYPE, discoverTmdbParams } from "./tmdb-discover-params";

describe("discoverTmdbParams (FIL-I60-2)", () => {
  it("keeps the defaults it always had", () => {
    assert.deepEqual(discoverTmdbParams(), { sort_by: "popularity.desc", include_adult: "false", page: "1" });
    assert.deepEqual(
      discoverTmdbParams({ kind: "MOVIE", withGenres: [28, 12], withWatchProviders: [8, 119], region: "MX" }),
      {
        sort_by: "popularity.desc",
        include_adult: "false",
        page: "1",
        region: "MX",
        with_genres: "28,12",
        with_watch_providers: "8|119",
        watch_region: "MX",
        with_watch_monetization_types: "flatrate",
      },
    );
  });

  it("maps the year window to the release date of each kind", () => {
    const movie = discoverTmdbParams({ kind: "MOVIE", yearFrom: 2024, yearTo: 2026 });
    assert.equal(movie["primary_release_date.gte"], "2024-01-01");
    assert.equal(movie["primary_release_date.lte"], "2026-12-31");
    const series = discoverTmdbParams({ kind: "SERIES", yearFrom: 2024, yearTo: 2026, year: 2025 });
    assert.equal(series["first_air_date.gte"], "2024-01-01");
    assert.equal(series["first_air_date.lte"], "2026-12-31");
    assert.equal(series.first_air_date_year, "2025");
    assert.equal(series["primary_release_date.gte"], undefined);
  });

  it("maps vote floors and ceilings", () => {
    const params = discoverTmdbParams({ voteAverageGte: 7.3, voteCountGte: 200, voteCountLte: 5000 });
    assert.equal(params["vote_average.gte"], "7.3");
    assert.equal(params["vote_count.gte"], "200");
    assert.equal(params["vote_count.lte"], "5000");
  });

  it("maps the runtime window", () => {
    const params = discoverTmdbParams({ runtimeGte: 60, runtimeLte: 100 });
    assert.equal(params["with_runtime.gte"], "60");
    assert.equal(params["with_runtime.lte"], "100");
  });

  it("ORs keywords and any-genres, and refuses to mix AND and OR genres", () => {
    assert.equal(discoverTmdbParams({ withKeywords: [156924, 346048] }).with_keywords, "156924|346048");
    assert.equal(discoverTmdbParams({ withAnyGenres: [28, 12, 53] }).with_genres, "28|12|53");
    assert.equal(discoverTmdbParams({ withoutGenres: [16, 99] }).without_genres, "16|99");
    assert.throws(() => discoverTmdbParams({ withGenres: [18], withAnyGenres: [10749] }));
  });

  it("sends the series type only to /discover/tv", () => {
    assert.equal(discoverTmdbParams({ kind: "SERIES", tvTypes: [TMDB_TV_TYPE.miniseries] }).with_type, "2");
    assert.equal(discoverTmdbParams({ kind: "MOVIE", tvTypes: [TMDB_TV_TYPE.miniseries] }).with_type, undefined);
  });
});
