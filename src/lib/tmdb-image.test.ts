import assert from "node:assert/strict";
import test from "node:test";
import { isTmdbImage } from "./tmdb";

test("isTmdbImage reconoce los hosts de imágenes de TMDB", () => {
  assert.equal(isTmdbImage("https://image.tmdb.org/t/p/w342/abc.jpg"), true);
  assert.equal(isTmdbImage("https://media.themoviedb.org/t/p/w780/abc.jpg"), true);
});

test("isTmdbImage deja fuera locales, otros hosts y vacíos", () => {
  assert.equal(isTmdbImage("/posters/inception.jpg"), false);
  assert.equal(isTmdbImage("https://example.com/p.jpg"), false);
  assert.equal(isTmdbImage(""), false);
  assert.equal(isTmdbImage(null), false);
  assert.equal(isTmdbImage(undefined), false);
});
