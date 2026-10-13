import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pickTrailer, trailerEmbedUrl, type TmdbVideo } from "./tmdb-trailer";

const video = (overrides: Partial<TmdbVideo>): TmdbVideo => ({
  key: "abcDEF12345",
  site: "YouTube",
  type: "Trailer",
  official: true,
  iso_639_1: "en",
  iso_3166_1: "US",
  published_at: "2024-01-01T00:00:00.000Z",
  name: "Official Trailer",
  ...overrides,
});

describe("pickTrailer", () => {
  it("prefers es-MX, then es, then en", () => {
    const results = [
      video({ key: "english0001", iso_639_1: "en" }),
      video({ key: "spain000001", iso_639_1: "es", iso_3166_1: "ES" }),
      video({ key: "mexico00001", iso_639_1: "es", iso_3166_1: "MX" }),
    ];
    assert.equal(pickTrailer({ results })?.key, "mexico00001");
    assert.equal(pickTrailer({ results: results.slice(0, 2) })?.key, "spain000001");
    assert.equal(pickTrailer({ results: results.slice(0, 1) })?.key, "english0001");
  });

  it("only takes YouTube trailers", () => {
    assert.equal(
      pickTrailer({
        results: [
          video({ key: "teaser00001", type: "Teaser", iso_639_1: "es", iso_3166_1: "MX" }),
          video({ key: "vimeo000001", site: "Vimeo", iso_639_1: "es", iso_3166_1: "MX" }),
          video({ key: "trailer0001" }),
        ],
      })?.key,
      "trailer0001",
    );
  });

  it("an official trailer beats an unofficial one in a better language", () => {
    const results = [
      video({ key: "fandub00001", official: false, iso_639_1: "es", iso_3166_1: "MX" }),
      video({ key: "official001", official: true, iso_639_1: "en" }),
    ];
    assert.equal(pickTrailer({ results })?.key, "official001");
    assert.equal(pickTrailer({ results: results.slice(0, 1) })?.key, "fandub00001");
  });

  it("newest wins inside the same language", () => {
    const results = [
      video({ key: "older000001", published_at: "2020-01-01T00:00:00.000Z" }),
      video({ key: "newer000001", published_at: "2023-05-01T00:00:00.000Z" }),
    ];
    assert.equal(pickTrailer({ results })?.key, "newer000001");
  });

  it("no trailer is null", () => {
    assert.equal(pickTrailer(null), null);
    assert.equal(pickTrailer({ results: [] }), null);
    assert.equal(pickTrailer({ results: [video({ iso_639_1: "fr" })] }), null);
    assert.equal(pickTrailer({ results: [video({ key: "bad key" })] }), null);
  });
});

describe("trailerEmbedUrl", () => {
  it("embeds from youtube-nocookie with rel=0", () => {
    const url = new URL(trailerEmbedUrl("abcDEF12345"));
    assert.equal(url.hostname, "www.youtube-nocookie.com");
    assert.equal(url.pathname, "/embed/abcDEF12345");
    assert.equal(url.searchParams.get("rel"), "0");
  });
});
