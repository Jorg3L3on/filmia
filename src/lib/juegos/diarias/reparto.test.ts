import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DIARIA_MIN_VOTES } from "@/lib/juegos/diarias/core";
import { buildRepartoRound, isRepartoPlayable, REPARTO_TRIES, repartoMarks, repartoState, topCast, type RepartoCandidate } from "@/lib/juegos/diarias/reparto";

const people = (count: number, offset = 0) => [
  { id: 900 + offset, name: `Dirección ${offset}`, role: "director", profilePath: null },
  ...Array.from({ length: count }, (_, index) => ({
    id: 1000 + offset * 20 + index,
    name: `Persona ${offset}-${index}`,
    role: "cast",
    order: count - 1 - index, // stored out of order on purpose
    character: `Papel ${index}`,
    profilePath: null,
  })),
  { id: 800 + offset, name: `Fotografía ${offset}`, role: "dp", profilePath: null },
];

const film = (index: number, cast: number, votes = DIARIA_MIN_VOTES): RepartoCandidate => ({
  id: `r${String(index).padStart(3, "0")}`,
  tmdbId: 5000 + index,
  imdbVotes: votes,
  tmdbPeople: people(cast, index),
});

describe("Reparto misterioso: who can play (FIL-I54-3)", () => {
  it("only films with six or more cast members are chosen", () => {
    assert.ok(isRepartoPlayable(film(1, 6)));
    assert.ok(isRepartoPlayable(film(2, 8)));
    assert.ok(!isRepartoPlayable(film(3, 5)), "five cast and a director and a DP are not six cast");
    assert.ok(!isRepartoPlayable(film(4, 8, DIARIA_MIN_VOTES - 1)), "not well known");
    const pool = [film(1, 6), film(2, 8), film(3, 5), film(5, 4), film(6, 2)];
    for (let day = 0; day < 200; day += 1) {
      const round = buildRepartoRound({ pool, seed: `d${day}` })!;
      assert.ok(["r001", "r002"].includes(round.catalogId));
      assert.equal(round.cast.length, 6);
    }
    assert.equal(buildRepartoRound({ pool: [film(3, 5)], seed: "x" }), null);
  });

  it("the cast comes from the lowest billed of the top six to the lead", () => {
    const top = topCast(people(8, 0));
    assert.deepEqual(top.map((person) => person.name), ["Persona 0-7", "Persona 0-6", "Persona 0-5", "Persona 0-4", "Persona 0-3", "Persona 0-2"]);
    const round = buildRepartoRound({ pool: [film(0, 8)], seed: "x" })!;
    assert.equal(round.cast[0]!.name, "Persona 0-2", "the 6th billed first");
    assert.equal(round.cast.at(-1)!.name, "Persona 0-7", "the lead last");
  });

  it("the same seed gives the same film, whatever the pool's order", () => {
    const pool = Array.from({ length: 20 }, (_, index) => film(index, 7));
    assert.deepEqual(buildRepartoRound({ pool, seed: "x" }), buildRepartoRound({ pool: [...pool].reverse(), seed: "x" }));
  });
});

describe("Reparto misterioso: tries (FIL-I54-3)", () => {
  it("each miss uncovers one more; a hit on try n scores 7 − n; six misses end it", () => {
    const miss = { g: 1, n: "Otra", ok: false };
    const pista = { g: null, n: null, ok: false };
    const hit = { g: 2, n: "Esa", ok: true };
    assert.equal(repartoState([]).shown, 1);
    const third = repartoState([miss, pista, hit]);
    assert.ok(third.solved && third.finished);
    assert.equal(third.score, 4);
    assert.deepEqual(third.misses, ["Otra"]);
    assert.equal(repartoMarks(third), "🟥🟥🟩⬜⬜⬜");
    const lost = repartoState(Array.from({ length: REPARTO_TRIES }, () => miss));
    assert.ok(lost.finished && !lost.solved);
    assert.equal(lost.shown, 6);
    assert.equal(lost.score, 0);
    assert.equal(repartoState(Array.from({ length: 5 }, () => miss)).shown, 6);
  });
});
