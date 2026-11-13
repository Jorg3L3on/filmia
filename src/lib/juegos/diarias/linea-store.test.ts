import "@/lib/test-support/node-async-local-storage";

import assert from "node:assert/strict";
import { after, before, it } from "node:test";
import { and, eq } from "drizzle-orm";
import { catalog, db, juegoRondas } from "@/db";
import { closeLocalPg } from "@/db/local-pg";
import { DIARIA_MIN_VOTES } from "@/lib/juegos/diarias/core";
import { fitsGap, LINEA_ID, LINEA_LIVES, type LineaRound } from "@/lib/juegos/diarias/linea";
import { answerLinea, loadLineaPool, openLinea, type LineaSources, type LineaView } from "@/lib/juegos/diarias/linea-store";
import { loadDiariaTable } from "@/lib/juegos/diarias/store";
import { describeWithDb } from "@/lib/test-support/local-db";
import { seeder } from "@/lib/test-support/seed";

/** FIL-I54-2 · Línea de tiempo on the local database, over fifteen fictitious films of distinct years. */
describeWithDb("Línea de tiempo store (FIL-I54-2)", () => {
  const seed = seeder("t-linea");
  const now = new Date("2031-04-11T18:00:00Z");
  const day = "2031-04-11";
  const ids = new Set<string>();
  let ana = "";
  let beto = "";
  const sources: LineaSources = { pool: async () => (await loadLineaPool()).filter((film) => ids.has(film.id)) };
  const cleanRounds = () => db.delete(juegoRondas).where(and(eq(juegoRondas.juego, LINEA_ID), eq(juegoRondas.day, day)));
  const round = async () => (await db.query.juegoRondas.findFirst({ where: and(eq(juegoRondas.juego, LINEA_ID), eq(juegoRondas.day, day)) }))!.content as LineaRound;

  before(async () => {
    await cleanRounds();
    ana = await seed.user("Ana");
    beto = await seed.user("Beto");
    for (let index = 0; index < 15; index += 1) {
      const film = await seed.film({ name: `Línea de prueba ${index}`, year: 1931 + index * 6 });
      await db.update(catalog).set({ imdbVotes: DIARIA_MIN_VOTES + 1 }).where(eq(catalog.id, film.catalogId));
      ids.add(film.catalogId);
    }
  });

  after(async () => {
    await cleanRounds();
    await seed.cleanup();
    await closeLocalPg();
  });

  /** The card to place never travels with its year. */
  const assertYearHidden = async (view: LineaView) => {
    if (!view.card) return;
    const card = (await round()).cards[view.cardNumber]!;
    assert.ok(!JSON.stringify(view).includes(String(card.year)), `the year ${card.year} travelled`);
  };

  /** The right gap for the current card (what a cheater would need). */
  const rightGap = async (view: LineaView) => {
    const year = (await round()).cards[view.cardNumber]!.year;
    return view.line.findIndex((_, gap) => fitsGap(view.line, gap, year)) === -1 ? view.line.length : view.line.findIndex((_, gap) => fitsGap(view.line, gap, year));
  };

  it("two accounts get the same nine films; the year of the card arrives only once placed", async () => {
    const a = await openLinea(ana, now, sources);
    const b = await openLinea(beto, now, sources);
    if (a.status !== "ok" || b.status !== "ok") return assert.fail("not opened");
    assert.equal(a.view.line.length, 1);
    assert.deepEqual(a.view.line, b.view.line);
    assert.deepEqual(a.view.card, b.view.card);
    await assertYearHidden(a.view);
    const gap = await rightGap(a.view);
    const placed = await answerLinea(ana, a.view.partidaId, a.view.step, gap, now);
    assert.ok(placed.ok && placed.correct);
    assert.equal(placed.year, (await round()).cards[1]!.year);
    await assertYearHidden(placed.view);
  });

  it("a wrong gap costs a life and puts the card in its real place; three end the partida", async () => {
    const opened = await openLinea(ana, now, sources);
    if (opened.status !== "ok") return assert.fail("not opened");
    let view = opened.view;
    for (let miss = 1; miss <= LINEA_LIVES; miss += 1) {
      const right = await rightGap(view);
      const wrong = right === 0 ? view.line.length : 0;
      const name = view.card!.name;
      const outcome = await answerLinea(ana, view.partidaId, view.step, wrong, now);
      assert.ok(outcome.ok && !outcome.correct);
      view = outcome.view;
      assert.equal(view.lives, LINEA_LIVES - miss);
      const years = view.line.map((item) => item.year);
      assert.deepEqual(years, [...years].sort((x, y) => x - y), "the line stays in order");
      assert.equal(view.line.find((item) => item.name === name)?.ok, false);
    }
    assert.ok(view.finished);
    assert.equal(view.score, 1);
    const late = await answerLinea(ana, view.partidaId, view.step, 0, now);
    assert.equal(late.ok, false);
    const table = await loadDiariaTable(ana, LINEA_ID, day, now);
    assert.equal(table.table.find((row) => row.me)?.score, 1);
  });
});
