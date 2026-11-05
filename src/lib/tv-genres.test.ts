import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseTmdbGenres, storedGenreIdsFor } from "@/lib/tmdb-details";

describe("TV genres read as their Spanish film genres (UX-08)", () => {
  it("splits the paired TV genres and keeps one chip per genre", () => {
    const genres = parseTmdbGenres([
      { id: 10765, name: "Sci-Fi & Fantasy" },
      { id: 878, name: "Ciencia ficción" },
      { id: 10759, name: "Action & Adventure" },
      { id: 10768, name: "War & Politics" },
      { id: 10762, name: "Kids" },
      { id: 18, name: "Drama" },
    ]);
    assert.deepEqual(
      genres.map((genre) => genre.name),
      ["Ciencia ficción", "Fantasía", "Acción", "Aventura", "Bélica", "Infantil", "Drama"],
    );
    assert.equal(genres.some((genre) => /&|Kids|War/.test(genre.name)), false);
  });

  it("still finds stored TV ids for a merged genre", () => {
    assert.deepEqual(storedGenreIdsFor([878]).sort(), [10765, 878].sort());
    assert.deepEqual(storedGenreIdsFor([18]), [18]);
  });
});
