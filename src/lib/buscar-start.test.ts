import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { rankFavoriteDirectors } from "./favorite-directors";
import { SEARCH_RECENTS_MAX, parseSearchRecents, pushSearchRecent } from "./search-recents";

describe("Buscar recientes", () => {
  it("keeps the newest first, one per query ignoring case and accents", () => {
    let recents: string[] = [];
    recents = pushSearchRecent(recents, "dune");
    recents = pushSearchRecent(recents, "  Villeneuve ");
    recents = pushSearchRecent(recents, "DUNE");
    assert.deepEqual(recents, ["DUNE", "Villeneuve"]);
    assert.deepEqual(pushSearchRecent(["Amélie"], "amelie"), ["amelie"]);
    assert.deepEqual(pushSearchRecent(["dune"], "   "), ["dune"]);
  });

  it("caps the list", () => {
    const many = Array.from({ length: 10 }, (_, index) => `q${index}`).reduce(pushSearchRecent, [] as string[]);
    assert.equal(many.length, SEARCH_RECENTS_MAX);
    assert.equal(many[0], "q9");
  });

  it("survives whatever localStorage holds", () => {
    assert.deepEqual(parseSearchRecents(null), []);
    assert.deepEqual(parseSearchRecents("{nope"), []);
    assert.deepEqual(parseSearchRecents('{"a":1}'), []);
    assert.deepEqual(parseSearchRecents('["dune", 3, "", "Dune", "sicario"]'), ["dune", "sicario"]);
  });
});

describe("Directores de tus favoritas", () => {
  const villeneuve = { id: 137427, name: "Denis Villeneuve", role: "director" as const };
  const nolan = { id: 525, name: "Christopher Nolan", role: "director" as const };
  const anderson = { id: 5655, name: "Wes Anderson", role: "director" as const };
  const actor = { id: 1, name: "Timothée Chalamet", role: "cast" as const };

  it("ranks directors of loved titles, Favoritas first", () => {
    const ranked = rankFavoriteDirectors([
      { rating: 9, favorite: false, people: [villeneuve, actor] },
      { rating: 8, favorite: false, people: [villeneuve] },
      { rating: 6, favorite: true, people: [anderson] },
      { rating: 10, favorite: false, people: [nolan] },
    ]);
    assert.deepEqual(
      ranked.map((director) => director.name),
      ["Wes Anderson", "Denis Villeneuve", "Christopher Nolan"],
    );
    assert.equal(ranked.find((director) => director.id === villeneuve.id)?.count, 2);
  });

  it("ignores titles you did not love and non-directors", () => {
    assert.deepEqual(
      rankFavoriteDirectors([
        { rating: 7, favorite: false, people: [villeneuve] },
        { rating: null, favorite: false, people: [nolan] },
        { rating: 10, favorite: false, people: [actor] },
      ]),
      [],
    );
  });

  it("counts a director once per title and respects the limit", () => {
    const ranked = rankFavoriteDirectors([{ rating: 10, favorite: false, people: [nolan, nolan] }], 1);
    assert.deepEqual(ranked, [{ id: nolan.id, name: nolan.name, count: 1 }]);
  });
});
