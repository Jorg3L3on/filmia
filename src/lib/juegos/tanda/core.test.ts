import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  answeredLens,
  corteHeadline,
  dealtLens,
  epochsOfWeek,
  isSeenAnswer,
  parseTandaLens,
  pickTanda,
  TANDA_EPOCHS,
  TANDA_RATING,
  TANDA_SIZE,
  type TandaCandidate,
} from "@/lib/juegos/tanda/core";

const films = (from: number, count: number, genreIds: number[] = [18]): TandaCandidate[] =>
  Array.from({ length: count }, (_, index) => ({ tmdbId: from + index, voteCount: 10_000 - index, genreIds }));

describe("La tanda's deal (FIL-I50-3)", () => {
  it("deals ten with the 6 / 2 / 2 mix, none repeated, none excluded", () => {
    const popular = films(1, 20);
    // Afines overlap the popular list and the excluded set on purpose.
    const afines = [...films(1, 2), ...films(100, 4)];
    const comodines = [...films(200, 3, [18]), ...films(300, 3, [27])];
    const exclude = new Set([3, 100]);
    const deal = pickTanda({ popular, afines, comodines, exclude, knownGenres: new Set([18]) });
    assert.equal(deal.length, TANDA_SIZE);
    assert.equal(new Set(deal.map((film) => film.tmdbId)).size, TANDA_SIZE);
    assert.ok(deal.every((film) => !exclude.has(film.tmdbId)));
    const bySlot = (slot: string) => deal.filter((film) => film.slot === slot);
    assert.equal(bySlot("p").length, 6);
    assert.equal(bySlot("a").length, 2);
    assert.equal(bySlot("c").length, 2);
    // Comodines prefer a genre the person does not watch.
    assert.ok(bySlot("c").every((film) => film.genreIds?.includes(27)));
    // Afines and comodines are spread through the deck, not bunched at the end.
    assert.deepEqual(
      deal.map((film) => film.slot),
      ["p", "p", "a", "p", "c", "p", "a", "p", "c", "p"],
    );
  });

  it("a person with no seeds still gets ten: the afines become popular", () => {
    const deal = pickTanda({ popular: films(1, 30), afines: [], comodines: films(500, 5), exclude: new Set() });
    assert.equal(deal.length, TANDA_SIZE);
    assert.equal(deal.filter((film) => film.slot === "p").length, 8);
  });

  it("never deals a film the person has or was already asked", () => {
    const deal = pickTanda({ popular: films(1, 12), afines: [], comodines: [], exclude: new Set([1, 2, 3, 4, 5]) });
    assert.equal(deal.length, 7);
    assert.ok(deal.every((film) => film.tmdbId > 5));
  });

  it("rotates the epoch weekly; the comodines come from another one", () => {
    const one = epochsOfWeek("2026-11-09");
    const next = epochsOfWeek("2026-11-16");
    assert.notDeepEqual(one.main, next.main);
    assert.notDeepEqual(one.main, one.wild);
    assert.ok(TANDA_EPOCHS.includes(one.main));
  });
});

describe("La tanda's answers", () => {
  it("writes implied ratings the engine reads, never stars", () => {
    assert.deepEqual(TANDA_RATING, { liked: 8, meh: 4, loved: 10 });
    assert.equal(isSeenAnswer("want"), false);
    assert.equal(isSeenAnswer("no"), false);
    assert.equal(isSeenAnswer("loved"), true);
  });

  it("encodes the week, the slot and whether the answer created the title", () => {
    assert.deepEqual(parseTandaLens(dealtLens("2026-11-09", "a")), { week: "2026-11-09", slot: "a", answer: null, createdTitle: false });
    assert.deepEqual(parseTandaLens(answeredLens("2026-11-09", "loved", true)), {
      week: "2026-11-09",
      slot: null,
      answer: "loved",
      createdTitle: true,
    });
    assert.equal(corteHeadline(0), "Ninguna esta vez");
    assert.equal(corteHeadline(6), "Viste 6 de 10");
  });
});
