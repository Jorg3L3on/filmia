import "@/lib/test-support/node-async-local-storage";

import assert from "node:assert/strict";
import { after, before, it } from "node:test";
import { and, eq } from "drizzle-orm";
import { catalog, db, juegoRondas } from "@/db";
import { closeLocalPg } from "@/db/local-pg";
import { DIARIA_MIN_VOTES } from "@/lib/juegos/diarias/core";
import { REPARTO_ID, REPARTO_TRIES, type RepartoRound } from "@/lib/juegos/diarias/reparto";
import { answerReparto, loadRepartoPool, openReparto, type RepartoSources, type RepartoView } from "@/lib/juegos/diarias/reparto-store";
import { loadDiariaTable } from "@/lib/juegos/diarias/store";
import { describeWithDb } from "@/lib/test-support/local-db";
import { seeder } from "@/lib/test-support/seed";

/** FIL-I54-3 · Reparto misterioso on the local database, over three fictitious films with eight cast. */
describeWithDb("Reparto misterioso store (FIL-I54-3)", () => {
  const seed = seeder("t-reparto");
  const now = new Date("2031-04-12T18:00:00Z");
  const day = "2031-04-12";
  const ids = new Set<string>();
  const names = new Map<string, string>();
  let ana = "";
  let beto = "";
  const sources: RepartoSources = { pool: async () => (await loadRepartoPool()).filter((film) => ids.has(film.id)) };
  const cleanRounds = () => db.delete(juegoRondas).where(and(eq(juegoRondas.juego, REPARTO_ID), eq(juegoRondas.day, day)));
  const round = async () => (await db.query.juegoRondas.findFirst({ where: and(eq(juegoRondas.juego, REPARTO_ID), eq(juegoRondas.day, day)) }))!.content as RepartoRound;

  before(async () => {
    await cleanRounds();
    ana = await seed.user("Ana");
    beto = await seed.user("Beto");
    for (let index = 0; index < 3; index += 1) {
      const name = `Reparto de prueba ${index}`;
      const film = await seed.film({ name });
      const tmdbPeople = Array.from({ length: 8 }, (_, order) => ({ id: 70_000 + index * 10 + order, name: `Actriz ${index}-${order}`, role: "cast", order, character: `Papel ${order}` }));
      await db.update(catalog).set({ imdbVotes: DIARIA_MIN_VOTES + 1, tmdbPeople }).where(eq(catalog.id, film.catalogId));
      ids.add(film.catalogId);
      names.set(film.catalogId, name);
    }
  });

  after(async () => {
    await cleanRounds();
    await seed.cleanup();
    await closeLocalPg();
  });

  /** The view carries only the people already uncovered, and never the film before the end. */
  const assertCovered = async (view: RepartoView) => {
    const r = await round();
    const json = JSON.stringify(view);
    for (const person of r.cast.slice(view.cast.length)) assert.ok(!json.includes(person.name), `${person.name} travelled while covered`);
    if (!view.finished) {
      assert.ok(!json.includes(names.get(r.catalogId)!), "the film travelled");
      assert.ok(!json.includes(String(r.tmdbId)), "the film's TMDB id travelled");
    }
  };

  it("two accounts see the same 6th-billed person first, and nothing else", async () => {
    const a = await openReparto(ana, now, sources);
    const b = await openReparto(beto, now, sources);
    if (a.status !== "ok" || b.status !== "ok") return assert.fail("not opened");
    assert.equal(a.view.cast.length, 1);
    assert.equal(a.view.cast[0]!.billing, 6);
    assert.deepEqual(a.view.cast, b.view.cast);
    assert.equal(a.view.hidden, 5);
    await assertCovered(a.view);
  });

  it("each miss uncovers one more; six misses show the answer, the whole cast and the day table", async () => {
    const opened = await openReparto(ana, now, sources);
    if (opened.status !== "ok") return assert.fail("not opened");
    let view = opened.view;
    for (let attempt = 1; attempt <= REPARTO_TRIES; attempt += 1) {
      const outcome = await answerReparto(ana, view.partidaId, view.step, attempt % 2 ? { tmdbId: 1, name: `Fallo ${attempt}` } : null, now);
      assert.ok(outcome.ok && !outcome.correct);
      view = outcome.view;
      if (!view.finished) {
        assert.equal(view.cast.length, attempt + 1);
        await assertCovered(view);
      }
    }
    assert.ok(view.finished && !view.solved);
    assert.equal(view.cast.length, 6);
    assert.equal(view.answer?.name, names.get((await round()).catalogId));
    assert.deepEqual(view.misses, ["Fallo 1", "Fallo 3", "Fallo 5"]);
    const table = await loadDiariaTable(ana, REPARTO_ID, day, now);
    assert.equal(table.table.find((row) => row.me)?.finished, true);
    assert.equal(table.table.find((row) => row.me)?.score, 0);
  });

  it("a hit on the second try scores five", async () => {
    const opened = await openReparto(beto, now, sources);
    if (opened.status !== "ok") return assert.fail("not opened");
    const first = await answerReparto(beto, opened.view.partidaId, opened.view.step, null, now);
    assert.ok(first.ok);
    const r = await round();
    const second = await answerReparto(beto, first.view.partidaId, first.view.step, { tmdbId: r.tmdbId, name: "x" }, now);
    assert.ok(second.ok && second.correct);
    assert.equal(second.view.score, 5);
    assert.ok(second.view.finished);
    const table = await loadDiariaTable(beto, REPARTO_ID, day, now);
    assert.equal(table.table[0]!.name, "Beto");
    assert.equal(table.table[0]!.place, 1);
  });
});
