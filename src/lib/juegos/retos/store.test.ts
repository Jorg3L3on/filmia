import "@/lib/test-support/node-async-local-storage";

import assert from "node:assert/strict";
import { after, before, it } from "node:test";
import { inArray } from "drizzle-orm";
import { catalog, db, juegoRetos, users } from "@/db";
import { closeLocalPg } from "@/db/local-pg";
import { MAYOR_ID, MAYOR_MIN_VOTES } from "@/lib/juegos/mayor/core";
import { answerMayor, type MayorView } from "@/lib/juegos/mayor/store";
import { createPartida, finishPartida, readPartida, recordAnswer } from "@/lib/juegos/partidas";
import { RETO_MAX_OPEN_TO_SAME, RETO_MS } from "@/lib/juegos/retos/core";
import { openMayorRetoSide, retoFromFreeMayor } from "@/lib/juegos/retos/mayor";
import {
  listMyRetos,
  listRetables,
  listTeToca,
  loadHeadToHead,
  readReto,
  RetoError,
  settleRetoPartida,
} from "@/lib/juegos/retos/store";
import { describeWithDb } from "@/lib/test-support/local-db";
import { seeder } from "@/lib/test-support/seed";

/** FIL-I53-1 · the reto on the local database: same sequence, 48 hours, the cap, no emails. */
describeWithDb("Retos (FIL-I53-1)", () => {
  const seed = seeder("t-retos");
  const t0 = new Date("2031-05-10T18:00:00Z");
  const films: string[] = [];
  const ratingOf = new Map<string, number>();
  let ana = "";
  let beto = "";
  let caro = "";
  const retoIds: string[] = [];

  /** A finished free streak of `userId` over the seeded films, `score` right before the miss. */
  const finishedStreak = async (userId: string, score: number, now = t0) => {
    const partida = await createPartida({ userId, juego: MAYOR_ID, mode: "libre", lens: "imdb", content: { sequence: films }, now });
    const answers = [...Array.from({ length: score }, () => true), false];
    let current = partida;
    for (const [index, ok] of answers.entries()) {
      await recordAnswer({ partida: current, answer: ok, score: index + (ok ? 1 : 0), finished: !ok, now });
      current = (await readPartida(userId, partida.id))!;
    }
    await finishPartida(partida.id, now);
    return partida.id;
  };

  const truthOf = (view: MayorView) =>
    ratingOf.get(view.step!.right.catalogId)! > ratingOf.get(view.step!.left.catalogId)! ? "mayor" : "menor";

  before(async () => {
    ana = await seed.user("Ana Ruiz");
    beto = await seed.user("Beto");
    caro = await seed.user("Carolina");
    for (let index = 0; index < 12; index += 1) {
      const film = await seed.film({ name: `Reto ${index + 1}`, year: 1990 + index });
      const rating = Math.round((5 + index * 0.31 + (index % 2 ? 1.2 : 0)) * 10) / 10;
      ratingOf.set(film.catalogId, rating);
      await db.update(catalog).set({ imdbRating: rating, imdbVotes: MAYOR_MIN_VOTES + 1 }).where(inArray(catalog.id, [film.catalogId]));
      films.push(film.catalogId);
    }
  });

  after(async () => {
    if (retoIds.length) await db.delete(juegoRetos).where(inArray(juegoRetos.id, retoIds));
    await seed.cleanup();
    await closeLocalPg();
  });

  it("the receiver plays exactly the sender's sequence, and finishing it settles the reto", async () => {
    const partidaId = await finishedStreak(ana, 4);
    const reto = await retoFromFreeMayor({ userId: ana, partidaId, toUserId: beto, now: t0 });
    retoIds.push(reto.id);
    assert.deepEqual((reto.content as { sequence: string[] }).sequence, films);

    const view = (await openMayorRetoSide(beto, reto, t0))!;
    assert.equal(view.mode, "reto");
    assert.deepEqual([view.step!.left.catalogId, view.step!.right.catalogId], [films[0], films[1]]);
    // A second open (another tab) gets the same partida, not a new one.
    const again = (await openMayorRetoSide(beto, (await readReto(reto.id))!, t0))!;
    assert.equal(again.partidaId, view.partidaId);
    const stored = (await readPartida(beto, view.partidaId))!;
    assert.deepEqual((stored.content as { sequence: string[] }).sequence, films);

    // Beto answers right five times (one more than Ana), then misses.
    let current = view;
    for (let step = 0; step < 6; step += 1) {
      const guess = step < 5 ? truthOf(current) : truthOf(current) === "mayor" ? "menor" : "mayor";
      const outcome = await answerMayor(beto, current.partidaId, step, guess, t0);
      assert.ok(outcome.ok);
      current = outcome.view;
    }
    assert.equal(current.finished, true);
    assert.equal(current.score, 5);
    await settleRetoPartida((await readPartida(beto, current.partidaId))!, t0);
    assert.equal((await readReto(reto.id))!.status, "jugado");
    assert.deepEqual(await loadHeadToHead(beto, ana), { mine: 1, theirs: 0, ties: 0, played: 1 });
  });

  it("a reto expires at 48 hours and stops being listed for both", async () => {
    const partidaId = await finishedStreak(ana, 2);
    const reto = await retoFromFreeMayor({ userId: ana, partidaId, toUserId: caro, now: t0 });
    retoIds.push(reto.id);
    const justBefore = new Date(t0.getTime() + RETO_MS - 60_000);
    const atExpiry = new Date(t0.getTime() + RETO_MS);
    assert.ok((await listTeToca(caro, justBefore)).some((item) => item.retoId === reto.id));
    assert.ok((await listMyRetos(ana, justBefore)).some((item) => item.retoId === reto.id));

    assert.ok(!(await listTeToca(caro, atExpiry)).some((item) => item.retoId === reto.id));
    assert.ok(!(await listMyRetos(ana, atExpiry)).some((item) => item.retoId === reto.id));
    assert.ok(!(await listMyRetos(caro, atExpiry)).some((item) => item.retoId === reto.id));
    assert.equal((await readReto(reto.id))!.status, "vencido");
    // An expired reto is not a defeat: it is not in the history.
    assert.equal((await loadHeadToHead(caro, ana)).played, 0);
  });

  it(`a fourth open reto toward the same account is refused (cap ${RETO_MAX_OPEN_TO_SAME})`, async () => {
    const later = new Date(t0.getTime() + 3 * RETO_MS);
    for (let index = 0; index < RETO_MAX_OPEN_TO_SAME; index += 1) {
      const partidaId = await finishedStreak(caro, index + 1, later);
      const reto = await retoFromFreeMayor({ userId: caro, partidaId, toUserId: beto, now: later });
      retoIds.push(reto.id);
    }
    const partidaId = await finishedStreak(caro, 1, later);
    await assert.rejects(
      retoFromFreeMayor({ userId: caro, partidaId, toUserId: beto, now: later }),
      (error: unknown) => error instanceof RetoError && error.code === "cap",
    );
    // The picker says so instead of offering the person.
    const full = (await listRetables(caro, later)).find((person) => person.userId === beto)!;
    assert.equal(full.full, true);
    // Toward someone else it still works.
    const other = await retoFromFreeMayor({ userId: caro, partidaId, toUserId: ana, now: later });
    retoIds.push(other.id);
    // Once those expire the cap frees up again.
    const free = (await listRetables(caro, new Date(later.getTime() + RETO_MS + 1))).find((person) => person.userId === beto)!;
    assert.equal(free.full, false);
  });

  it("the list of people never carries an email", async () => {
    const people = await listRetables(ana, t0);
    const emails = (await db.select({ email: users.email }).from(users)).map((row) => row.email);
    const json = JSON.stringify(people);
    for (const email of emails) assert.ok(!json.includes(email), "an email travelled in the list");
    assert.ok(!json.includes("@"));
    for (const person of people) assert.deepEqual(Object.keys(person).sort(), ["full", "initial", "line", "name", "userId"]);
    assert.ok(!people.some((person) => person.userId === ana), "the person is not in their own list");
    const betoRow = people.find((person) => person.userId === beto)!;
    assert.equal(betoRow.name, "Beto");
    assert.equal(betoRow.line, "Van 1 a 0 en tu contra");
  });

  it("nobody can challenge themself", async () => {
    const partidaId = await finishedStreak(ana, 1);
    await assert.rejects(
      retoFromFreeMayor({ userId: ana, partidaId, toUserId: ana, now: t0 }),
      (error: unknown) => error instanceof RetoError && error.code === "self",
    );
  });
});
