import "@/lib/test-support/node-async-local-storage";

import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { inArray } from "drizzle-orm";
import { db, juegoRetos, titles } from "@/db";
import { closeLocalPg } from "@/db/local-pg";
import { readPartida } from "@/lib/juegos/partidas";
import { buildGustosPairs, GUSTOS_MIN_GAP, gustosWinner } from "@/lib/juegos/retos/gustos-core";
import {
  answerGustos,
  gustosEligible,
  loadOwnRatings,
  openGustosSide,
  setJuegosNotasFor,
  startGustosReto,
  viewGustosPartida,
} from "@/lib/juegos/retos/gustos";
import { readReto, RetoError, settleRetoPartida } from "@/lib/juegos/retos/store";
import { answerTrivia, askTrivia, openTriviaSide, startTriviaReto, viewTriviaPartida } from "@/lib/juegos/retos/trivia";
import { TRIVIA_MS, type TriviaCandidate, type TriviaQuestion } from "@/lib/juegos/retos/trivia-core";
import { describeWithDb } from "@/lib/test-support/local-db";
import { seeder } from "@/lib/test-support/seed";

describe("Duelo de gustos: pairs (FIL-I53-6)", () => {
  const rated = Array.from({ length: 20 }, (_, index) => ({ catalogId: `g${index}`, rating: 1 + (index % 10) }));
  it("seven pairs, no film twice, never two films closer than two points", () => {
    for (let run = 0; run < 50; run += 1) {
      const pairs = buildGustosPairs(rated, `s${run}`)!;
      assert.equal(pairs.length, 7);
      const ids = pairs.flatMap((pair) => [pair.a, pair.b]);
      assert.equal(new Set(ids).size, 14);
      for (const pair of pairs) assert.ok(Math.abs(pair.ra - pair.rb) >= GUSTOS_MIN_GAP);
    }
  });
  it("finds seven pairs whenever the ratings allow them (a tight case)", () => {
    // 15 films, ratings 3–9: exactly seven pairs two points apart exist.
    const tight = [3, 4, 4, 5, 5, 6, 7, 8, 8, 8, 9, 9, 9, 9, 9].map((rating, index) => ({ catalogId: `t${index}`, rating }));
    for (let run = 0; run < 100; run += 1) assert.equal(buildGustosPairs(tight, `t${run}`)?.length, 7, `seed t${run}`);
  });
  it("too few films, or ratings all alike, give no duel", () => {
    assert.equal(buildGustosPairs(rated.slice(0, 13), "s"), null);
    assert.equal(buildGustosPairs(rated.map((row) => ({ ...row, rating: 7 })), "s"), null);
  });
});

/** FIL-I53-5/6 · the two duels on the local database. */
describeWithDb("Duelos de trivia y gustos (FIL-I53-5/6)", () => {
  const seed = seeder("t-duelos");
  const t0 = new Date("2031-07-01T18:00:00Z");
  const retoIds: string[] = [];
  let ana = "";
  let beto = "";
  let carla = "";

  const triviaPool = async (): Promise<TriviaCandidate[]> =>
    Array.from({ length: 30 }, (_, index) => ({
      id: `tp${index}`,
      name: `Cinta ${index + 1}`,
      posterPath: null,
      year: 1980 + index,
      runtimeMinutes: 90 + index * 3,
      imdbRating: 5 + index * 0.1,
      genres: ["Drama"],
      people: [
        { name: ["Ana Torres", "Luis Gómez", "Marta Ríos", "Pedro Sala"][index % 4]!, role: "director" },
        ...["Rosa", "Juan", "Lola", "Pepe", "Nora", "Tito"].map((first, order) => ({ name: `${first} ${String.fromCharCode(65 + ((index + order) % 20))}ez`, role: "cast", order })),
      ],
    }));

  /** Rated films for a person: own ratings 1..10 spread, plus implied ones that must never be used. */
  const rate = async (userId: string, count: number) => {
    for (let index = 0; index < count; index += 1) {
      const film = await seed.film({ name: `Gusto ${userId.slice(-4)} ${index}` });
      await seed.title(userId, film.catalogId, { rating: 1 + (index % 10) });
    }
    for (let index = 0; index < 5; index += 1) {
      const film = await seed.film({ name: `Implícita ${index}` });
      const id = await seed.title(userId, film.catalogId);
      await db.update(titles).set({ impliedRating: 8 }).where(inArray(titles.id, [id]));
    }
  };

  before(async () => {
    ana = await seed.user("Ana");
    beto = await seed.user("Beto");
    carla = await seed.user("Carla");
    await seed.collection(ana, "Juntos", [
      { userId: beto, role: "VIEWER" },
      { userId: carla, role: "VIEWER" },
    ]);
    await rate(ana, 16);
    await rate(beto, 16);
    await rate(carla, 16);
  });

  after(async () => {
    if (retoIds.length) await db.delete(juegoRetos).where(inArray(juegoRetos.id, retoIds));
    await seed.cleanup();
    await closeLocalPg();
  });

  it("trivia: both play the same five questions and a question's delivery never says which is right", async () => {
    const reto = await startTriviaReto({ userId: ana, toUserId: beto, now: t0, pool: triviaPool });
    retoIds.push(reto.id);
    const before = (await viewTriviaPartida(ana, reto.fromPartidaId!, t0))!;
    assert.equal(before.question, null, "nothing is handed over before asking");
    const asked = (await askTrivia(ana, reto.fromPartidaId!, 0, t0))!;
    assert.ok(asked.question);
    assert.equal(asked.msLeft, TRIVIA_MS);
    const json = JSON.stringify(asked);
    assert.ok(!json.includes('"correct"'), "the right option travelled with the question");
    // Asking again (a reload) keeps the clock running instead of restarting it.
    const again = (await askTrivia(ana, reto.fromPartidaId!, 0, new Date(t0.getTime() + 4000)))!;
    assert.equal(again.msLeft, TRIVIA_MS - 4000);

    const questions = (reto.content as { questions: TriviaQuestion[] }).questions;
    for (let index = 0; index < 5; index += 1) {
      const at = new Date(t0.getTime() + index * 60_000);
      await askTrivia(ana, reto.fromPartidaId!, index, at);
      const outcome = await answerTrivia(ana, reto.fromPartidaId!, index, questions[index]!.correct, new Date(at.getTime() + 2000));
      assert.ok(outcome.ok);
    }
    const done = (await readPartida(ana, reto.fromPartidaId!))!;
    assert.ok(done.finishedAt);
    await settleRetoPartida(done, t0);
    assert.ok((await readReto(reto.id))!.sentAt, "finishing sends the reto");

    const side = (await openTriviaSide(beto, (await readReto(reto.id))!, t0))!;
    const mine = (await readPartida(beto, side.partidaId))!;
    assert.deepEqual((mine.content as { questions: TriviaQuestion[] }).questions, questions);
  });

  it("trivia: an answer that reaches the server after 15 s is worth zero, even if right", async () => {
    const reto = await startTriviaReto({ userId: ana, toUserId: carla, now: t0, pool: triviaPool });
    retoIds.push(reto.id);
    const right = (reto.content as { questions: TriviaQuestion[] }).questions[0]!.correct;
    await askTrivia(ana, reto.fromPartidaId!, 0, t0);
    const late = await answerTrivia(ana, reto.fromPartidaId!, 0, right, new Date(t0.getTime() + TRIVIA_MS + 1));
    assert.ok(late.ok && late.correct);
    assert.equal(late.ok && late.points, 0);
    await askTrivia(ana, reto.fromPartidaId!, 1, t0);
    const second = (reto.content as { questions: TriviaQuestion[] }).questions[1]!.correct;
    const onTime = await answerTrivia(ana, reto.fromPartidaId!, 1, second, new Date(t0.getTime() + TRIVIA_MS));
    assert.equal(onTime.ok && onTime.points, 50);
    // A question never asked cannot be answered.
    const early = await answerTrivia(ana, reto.fromPartidaId!, 2, 0, t0);
    assert.equal(early.ok, false);
  });

  it("gustos: with the permission off on either account the duel cannot be made", async () => {
    await setJuegosNotasFor(ana, false);
    await setJuegosNotasFor(beto, true);
    await assert.rejects(startGustosReto({ userId: ana, toUserId: beto, now: t0 }), (error: unknown) => error instanceof RetoError && error.code === "permiso");
    await setJuegosNotasFor(ana, true);
    await setJuegosNotasFor(beto, false);
    await assert.rejects(startGustosReto({ userId: ana, toUserId: beto, now: t0 }), (error: unknown) => error instanceof RetoError && error.code === "permiso");
    assert.ok(!(await gustosEligible([beto])).has(beto));
    await setJuegosNotasFor(beto, true);
    assert.ok((await gustosEligible([beto])).has(beto));
  });

  it("gustos: only own ratings, and a pair reaches the client without them", async () => {
    const own = await loadOwnRatings(beto);
    assert.equal(own.length, 16, "implied ratings are not own ratings");
    const reto = await startGustosReto({ userId: ana, toUserId: beto, now: t0 });
    retoIds.push(reto.id);
    const content = reto.content as { forFrom: { a: string; b: string; ra: number; rb: number }[] };
    const ownIds = new Set(own.map((row) => row.catalogId));
    for (const pair of content.forFrom) {
      assert.ok(ownIds.has(pair.a) && ownIds.has(pair.b));
      assert.ok(Math.abs(pair.ra - pair.rb) >= 2);
    }
    const view = (await viewGustosPartida(ana, reto.fromPartidaId!))!;
    assert.ok(view.pair);
    assert.deepEqual(Object.keys(view.pair.a).sort(), ["catalogId", "name", "posterPath"]);
    assert.ok(!/"r[ab]"|"rating"/.test(JSON.stringify(view)), "a rating travelled before the answer");
    const outcome = await answerGustos(ana, reto.fromPartidaId!, 0, gustosWinner(content.forFrom[0]!), t0);
    assert.ok(outcome.ok && outcome.correct);
    assert.equal(outcome.ok && outcome.view.answered[0]!.ra, content.forFrom[0]!.ra);
  });

  it("gustos: turning the permission off cancels the open duels that use those notes", async () => {
    await setJuegosNotasFor(carla, true);
    const reto = await startGustosReto({ userId: carla, toUserId: beto, now: t0 });
    retoIds.push(reto.id);
    await openGustosSide(beto, reto, t0);
    const cancelled = await setJuegosNotasFor(beto, false, t0);
    assert.ok(cancelled >= 1);
    assert.equal((await readReto(reto.id))!.status, "cancelado");
    const blocked = await answerGustos(carla, reto.fromPartidaId!, 0, (reto.content as { forFrom: { a: string }[] }).forFrom[0]!.a, t0);
    assert.equal(blocked.ok, false);
    await setJuegosNotasFor(beto, true);
  });
});
