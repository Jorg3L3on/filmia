import assert from "node:assert/strict";
import test from "node:test";
import { isRemoteImage } from "./tmdb";

test("isRemoteImage reconoce URLs http(s), TMDB incluido", () => {
  assert.equal(isRemoteImage("https://image.tmdb.org/t/p/w342/abc.jpg"), true);
  assert.equal(isRemoteImage("https://media.themoviedb.org/t/p/w780/abc.jpg"), true);
  assert.equal(isRemoteImage("https://upload.wikimedia.org/wikipedia/en/6/6c/p.jpg"), true);
  assert.equal(isRemoteImage("http://example.com/p.jpg"), true);
});

test("isRemoteImage deja fuera locales y vacíos", () => {
  assert.equal(isRemoteImage("/posters/inception.jpg"), false);
  assert.equal(isRemoteImage(""), false);
  assert.equal(isRemoteImage(null), false);
  assert.equal(isRemoteImage(undefined), false);
});
