import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  answerOfLens,
  ocultaDetail,
  ocultaHint,
  pickOculta,
  pickVisteCards,
  placeOcultaLens,
  sameMxDay,
  VISTE_RATING,
  visteLens,
  visteSummary,
} from "./core";

describe("la oculta", () => {
  const pool = [
    { id: "close", gusto: 0.9, calidad: 0.9 },
    { id: "far-good", gusto: 0.2, calidad: 0.8 },
    { id: "far-best", gusto: 0.3, calidad: 0.95 },
    { id: "far-meh", gusto: 0.1, calidad: 0.4 },
  ];

  it("is the best rated film under your median taste", () => {
    // Median gusto 0.25: far-good and far-meh qualify, far-good rates better.
    assert.equal(pickOculta(pool, new Set())?.id, "far-good");
  });

  it("never repeats one dealt (or flipped, or in the deck)", () => {
    assert.equal(pickOculta(pool, new Set(["far-good"]))?.id, "far-best");
    assert.equal(pickOculta(pool, new Set(["far-best", "far-good", "far-meh", "close"])), null);
  });

  it("says the decade and genre, never the name", () => {
    assert.equal(ocultaHint({ year: 1968, genres: ["Ciencia ficción"] }), "Ciencia ficción, de los 1960");
    assert.equal(ocultaHint({ year: null, genres: [] }), "Una película sin fecha");
    assert.equal(
      ocultaDetail({ rating: 7.7, seedName: "Proyecto Fin del Mundo" }),
      "Buena según todos (7.7), lejos de lo que sueles ver. Sale de lo que va con Proyecto Fin del Mundo.",
    );
  });

  it("goes right after the rutas, else after Para ti", () => {
    const lens = (slug: string, kind: string) => ({ slug, kind });
    const oculta = lens("la-oculta", "pieza");
    assert.deepEqual(
      placeOcultaLens([lens("r1", "ruta"), lens("r2", "ruta"), lens("para-ti", "para-ti")], oculta).map((item) => item.slug),
      ["r1", "r2", "la-oculta", "para-ti"],
    );
    assert.deepEqual(
      placeOcultaLens([lens("para-ti", "para-ti"), lens("drama", "genre")], oculta).map((item) => item.slug),
      ["para-ti", "la-oculta", "drama"],
    );
    assert.deepEqual(placeOcultaLens([], oculta).map((item) => item.slug), ["la-oculta"]);
  });

  it("turns the day at midnight in Mexico City", () => {
    // 05:59 UTC is 23:59 in Mexico City (UTC-6), 06:01 UTC is the next day there.
    assert.equal(sameMxDay(new Date("2026-10-23T05:59:00Z"), new Date("2026-10-22T18:00:00Z")), true);
    assert.equal(sameMxDay(new Date("2026-10-23T06:01:00Z"), new Date("2026-10-23T05:59:00Z")), false);
  });
});

describe("¿Las viste?", () => {
  it("one card per seed, the best known first, never one you have", () => {
    const cards = pickVisteCards(
      [
        { seedName: "PHM", candidates: [{ tmdbId: 1, voteCount: 30000 }, { tmdbId: 2, voteCount: 20000 }] },
        { seedName: "LOTR", candidates: [{ tmdbId: 3, voteCount: 10000 }, { tmdbId: 1, voteCount: 30000 }] },
        { seedName: "Michael", candidates: [{ tmdbId: 4, voteCount: 5000 }] },
      ],
      new Set([3]),
    );
    assert.deepEqual(
      cards.map((card) => [card.tmdbId, card.seedName]),
      [
        [1, "PHM"],
        [4, "Michael"],
        [2, "PHM"],
      ],
    );
  });

  it("answers are events with what Afinidad reads", () => {
    assert.equal(visteLens("meh"), "viste:meh");
    assert.equal(answerOfLens("viste:liked"), "liked");
    assert.equal(answerOfLens("las-viste:PHM"), null);
    assert.ok(VISTE_RATING.liked >= 7, "«me gustó» counts as liked");
    assert.ok(VISTE_RATING.meh < 7, "«no tanto» counts as a negative");
  });

  it("closes with what changed, only gains", () => {
    assert.equal(
      visteSummary({ seen: 2, newPeople: ["Christopher Nolan", "Hans Zimmer", "Otro"], rutas: [{ shortTitle: "Lord & Miller", done: 2, total: 5 }] }),
      "Aparecieron Christopher Nolan y Hans Zimmer; Lord & Miller va 2 de 5.",
    );
    assert.equal(visteSummary({ seen: 1, newPeople: [], rutas: [] }), "Una más en tu diario.");
    assert.equal(visteSummary({ seen: 0, newPeople: [], rutas: [] }), "Ninguna esta vez. Mañana hay otras tres.");
  });
});
