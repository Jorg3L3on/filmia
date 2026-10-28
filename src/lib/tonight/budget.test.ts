import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  fitsRuntime,
  foldGenre,
  matchesGenres,
  moodById,
  MOODS,
  NO_LIMIT_ID,
  pickOptions,
  TIME_BUDGETS,
  widerBudget,
} from "./budget";

type Card = { id: string; runtime: number | null };
const card = (id: string, runtime: number | null): Card => ({ id, runtime });
const runtimeOf = (c: Card) => c.runtime;
const ids = (cards: readonly { id: string }[]) => cards.map((c) => c.id);

// Para ti first, then the other lenses: the order the sala deals.
const deck = [
  card("para-ti-1", 140),
  card("para-ti-2", 88),
  card("para-ti-3", null),
  card("drama-1", 95),
  card("drama-2", 90),
  card("drama-3", null),
  card("comedia-1", 82),
  card("comedia-2", 75),
];

describe("pickOptions (FIL-I31-1)", () => {
  it("returns at most three cards within the limit, in deck order", () => {
    const picked = pickOptions(deck, { maxRuntimeMin: 90 }, runtimeOf);
    assert.deepEqual(ids(picked.cards), ["para-ti-2", "drama-2", "comedia-1"]);
    assert.ok(picked.cards.every((c) => c.runtime != null && c.runtime <= 90));
  });

  it("excludes unknown-runtime cards and counts every one in the deck", () => {
    const picked = pickOptions(deck, { maxRuntimeMin: 90 }, runtimeOf);
    assert.ok(picked.cards.every((c) => c.runtime != null));
    assert.equal(picked.unknownRuntime, 2);
  });

  it("returns fewer than three when fewer fit, and none when nothing does", () => {
    assert.deepEqual(ids(pickOptions(deck, { maxRuntimeMin: 80 }, runtimeOf).cards), ["comedia-2"]);
    const none = pickOptions(deck, { maxRuntimeMin: 60 }, runtimeOf);
    assert.deepEqual(none.cards, []);
    assert.equal(none.unknownRuntime, 2);
  });

  it("without a limit returns the deck unchanged", () => {
    const picked = pickOptions(deck, { maxRuntimeMin: null }, runtimeOf);
    assert.deepEqual(picked.cards, deck);
    assert.notEqual(picked.cards, deck);
    assert.equal(picked.unknownRuntime, 0);
  });

  it("counts a card repeated across lenses once", () => {
    const picked = pickOptions([card("a", 80), card("a", 80), card("b", null), card("b", null)], { maxRuntimeMin: 90 }, runtimeOf);
    assert.deepEqual(ids(picked.cards), ["a"]);
    assert.equal(picked.unknownRuntime, 1);
  });
});

describe("time budgets", () => {
  it("fitsRuntime: the limit is inclusive and unknown never fits a limit", () => {
    assert.equal(fitsRuntime(90, 90), true);
    assert.equal(fitsRuntime(91, 90), false);
    assert.equal(fitsRuntime(null, 90), false);
    assert.equal(fitsRuntime(null, null), true);
  });

  it("chips read Tengo 90 min / 2 h / 3 h / Sin límite; wider steps up to no limit", () => {
    assert.deepEqual(
      TIME_BUDGETS.map((b) => b.label),
      ["90 min", "2 h", "3 h", "Sin límite"],
    );
    assert.equal(widerBudget("90")?.id, "120");
    assert.equal(widerBudget("180")?.id, NO_LIMIT_ID);
    assert.equal(widerBudget(NO_LIMIT_ID), null);
  });
});

type GenreCard = { id: string; runtime: number | null; genres: { name: string }[] };
const g = (id: string, runtime: number | null, ...names: string[]): GenreCard => ({
  id,
  runtime,
  genres: names.map((name) => ({ name })),
});
const moodDeck = [
  g("drama-largo", 150, "Drama"),
  g("comedia", 95, "Comedia"),
  g("terror", 88, "Terror", "Misterio"),
  g("anime", 85, "Animación", "Familia"),
  g("serie-scifi", 50, "Sci-Fi & Fantasy", "Drama"),
  g("docu", null, "Documental"),
  g("romcom", 100, "Romance", "Comedia"),
];
const moodRuntime = (c: GenreCard) => c.runtime;

describe("mood chips (FIL-I31-2)", () => {
  it("chips read Reír · Tensión · Emocionarme · Ligera · Pensar", () => {
    assert.deepEqual(
      MOODS.map((m) => m.label),
      ["Reír", "Tensión", "Emocionarme", "Ligera", "Pensar"],
    );
  });

  it("each mood returns only cards with one of its genres", () => {
    for (const mood of MOODS) {
      const picked = pickOptions(moodDeck, { maxRuntimeMin: null, genres: mood.genres }, moodRuntime);
      for (const card of picked.cards) {
        assert.ok(matchesGenres(card.genres, mood.genres), `${mood.id}: ${card.id}`);
      }
    }
    const reir = moodById("reir");
    assert.deepEqual(
      ids(pickOptions(moodDeck, { maxRuntimeMin: null, genres: reir?.genres }, moodRuntime).cards),
      ["comedia", "anime", "romcom"],
    );
    // TMDB's TV genres come back in English: «Pensar» still finds the series.
    assert.deepEqual(
      ids(pickOptions(moodDeck, { maxRuntimeMin: null, genres: moodById("pensar")?.genres }, moodRuntime).cards),
      ["serie-scifi", "docu"],
    );
  });

  it("with a time limit both apply, and only the limit hides unknown runtimes", () => {
    const both = pickOptions(moodDeck, { maxRuntimeMin: 90, genres: moodById("reir")?.genres }, moodRuntime);
    assert.deepEqual(ids(both.cards), ["anime"]);
    assert.equal(both.unknownRuntime, 0);
    const pensar90 = pickOptions(moodDeck, { maxRuntimeMin: 90, genres: moodById("pensar")?.genres }, moodRuntime);
    assert.deepEqual(ids(pensar90.cards), ["serie-scifi"]);
    assert.equal(pensar90.unknownRuntime, 1);
  });

  it("matchesGenres folds accents and case, needs whole names, and no list matches all", () => {
    assert.equal(matchesGenres([{ name: "Animación" }], ["animacion"]), true);
    assert.equal(matchesGenres([{ name: "Ciencia ficción" }], ["Ciencia"]), false);
    assert.equal(matchesGenres([], ["Drama"]), false);
    assert.equal(matchesGenres(null, undefined), true);
    assert.equal(foldGenre(" Bélica "), "belica");
  });
});
