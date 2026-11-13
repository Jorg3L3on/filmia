import "@/lib/test-support/node-async-local-storage";

import assert from "node:assert/strict";
import { after, before, it } from "node:test";
import { and, eq, inArray } from "drizzle-orm";
import { catalog, db, juegoPartidas, juegoRondas, titles } from "@/db";
import { closeLocalPg } from "@/db/local-pg";
import { DIARIA_MIN_VOTES } from "@/lib/juegos/diarias/core";
import { DETALLE_ID, DETALLE_LEVELS, type DetalleRound } from "@/lib/juegos/diarias/detalle";
import { answerDetalle, loadDetallePool, openDetalle, readCropSource, type DetalleSources, type DetalleView } from "@/lib/juegos/diarias/detalle-store";
import { loadDiariaTable } from "@/lib/juegos/diarias/store";
import { describeWithDb } from "@/lib/test-support/local-db";
import { seeder } from "@/lib/test-support/seed";

/** FIL-I54-1 · Detalle on the local database, over twelve fictitious films the suite seeds. */
describeWithDb("Detalle store (FIL-I54-1)", () => {
  const seed = seeder("t-detalle");
  const now = new Date("2031-04-10T18:00:00Z");
  const day = "2031-04-10";
  const films = new Map<string, { tmdbId: number; name: string; posterPath: string }>();
  let ana = "";
  let beto = "";

  const sources: DetalleSources = { pool: async () => (await loadDetallePool()).filter((film) => films.has(film.id)) };
  const cleanRounds = () => db.delete(juegoRondas).where(and(eq(juegoRondas.juego, DETALLE_ID), inArray(juegoRondas.day, [day])));

  before(async () => {
    await cleanRounds();
    ana = await seed.user("Ana");
    beto = await seed.user("Beto");
    for (let index = 0; index < 12; index += 1) {
      const name = `Detalle de prueba ${String(index).padStart(2, "0")}`;
      const film = await seed.film({ name, year: 1990 + index });
      const posterPath = `/detalle-prueba-${index}.jpg`;
      await db.update(catalog).set({ imdbVotes: DIARIA_MIN_VOTES + 5, posterPath }).where(eq(catalog.id, film.catalogId));
      films.set(film.catalogId, { tmdbId: film.tmdbId, name, posterPath });
    }
  });

  after(async () => {
    await cleanRounds();
    await seed.cleanup();
    await closeLocalPg();
  });

  /** Nothing about the posters still hidden may travel in a view. */
  const assertHidden = (view: DetalleView, round: DetalleRound) => {
    const json = JSON.stringify(view);
    for (const [index, poster] of round.posters.entries()) {
      if (["solved", "failed"].includes(view.posters[index]!.status)) continue;
      const film = films.get(poster.catalogId)!;
      assert.ok(!json.includes(film.posterPath), `poster ${index}'s path travelled`);
      assert.ok(!json.includes(JSON.stringify(film.name)), `poster ${index}'s name travelled`);
      assert.ok(!json.includes(poster.catalogId), `poster ${index}'s id travelled`);
      assert.ok(!json.includes(String(film.tmdbId)), `poster ${index}'s TMDB id travelled`);
    }
  };

  const roundOfDay = async () => (await db.query.juegoRondas.findFirst({ where: and(eq(juegoRondas.juego, DETALLE_ID), eq(juegoRondas.day, day)) }))!.content as DetalleRound;

  it("two accounts get the same posters, zones and levels; the view never carries a hidden poster", async () => {
    const a = await openDetalle(ana, now, sources);
    const b = await openDetalle(beto, now, sources);
    assert.equal(a.status, "ok");
    assert.equal(b.status, "ok");
    if (a.status !== "ok" || b.status !== "ok") return;
    const round = await roundOfDay();
    const rows = await db.query.juegoPartidas.findMany({ where: inArray(juegoPartidas.id, [a.view.partidaId, b.view.partidaId]) });
    assert.deepEqual(rows[0]!.content, rows[1]!.content);
    assert.deepEqual(rows[0]!.content, round);
    assertHidden(a.view, round);
    assert.equal(a.view.posters[0]!.status, "playing");
    assert.equal(a.view.posters[0]!.reveal, null);
  });

  it("the crop route only gets the poster up to the level reached; misses and «No sé» open it", async () => {
    const opened = await openDetalle(ana, now, sources);
    assert.equal(opened.status, "ok");
    if (opened.status !== "ok") return;
    let view = opened.view;
    const round = await roundOfDay();
    assert.ok(await readCropSource(ana, view.partidaId, 0, 1));
    assert.equal(await readCropSource(ana, view.partidaId, 0, 2), null, "level 2 before a miss");
    assert.equal(await readCropSource(ana, view.partidaId, 1, 1), null, "the next poster");
    assert.equal(await readCropSource(beto, view.partidaId, 0, 1), null, "someone else's partida");

    const wrong = await answerDetalle(ana, view.partidaId, view.step, { tmdbId: 999_999, name: "Otra cosa" }, now);
    assert.ok(wrong.ok && !wrong.correct);
    view = wrong.view;
    assert.equal(view.posters[0]!.level, 2);
    assert.deepEqual(view.posters[0]!.misses, ["Otra cosa"]);
    assertHidden(view, round);
    assert.ok(await readCropSource(ana, view.partidaId, 0, 2));

    // A retried request with the old step changes nothing.
    const retried = await answerDetalle(ana, view.partidaId, view.step - 1, null, now);
    assert.equal(retried.ok, false);

    const pass = await answerDetalle(ana, view.partidaId, view.step, null, now);
    assert.ok(pass.ok);
    view = pass.view;
    assert.equal(view.posters[0]!.level, 3);

    const right = films.get(round.posters[0]!.catalogId)!;
    const solved = await answerDetalle(ana, view.partidaId, view.step, { tmdbId: right.tmdbId, name: right.name }, now);
    assert.ok(solved.ok && solved.correct);
    view = solved.view;
    assert.equal(view.posters[0]!.status, "solved");
    assert.equal(view.posters[0]!.points, 4);
    assert.equal(view.posters[0]!.reveal?.posterPath, right.posterPath);
    assertHidden(view, round);
    assert.equal(view.current, 1);
  });

  it("six misses fail a poster and reveal it; the third poster ends the partida into the day table", async () => {
    const opened = await openDetalle(ana, now, sources);
    if (opened.status !== "ok") return assert.fail("not opened");
    let view = opened.view;
    for (let index = 0; index < DETALLE_LEVELS; index += 1) {
      const outcome = await answerDetalle(ana, view.partidaId, view.step, null, now);
      assert.ok(outcome.ok);
      view = outcome.view;
    }
    assert.equal(view.posters[1]!.status, "failed");
    assert.ok(view.posters[1]!.reveal?.posterPath);
    const round = await roundOfDay();
    const last = films.get(round.posters[2]!.catalogId)!;
    const outcome = await answerDetalle(ana, view.partidaId, view.step, { tmdbId: last.tmdbId, name: last.name }, now);
    assert.ok(outcome.ok);
    view = outcome.view;
    assert.ok(view.finished);
    assert.equal(view.score, 4 + 0 + 6);
    const after = await answerDetalle(ana, view.partidaId, view.step, null, now);
    assert.equal(after.ok, false);

    const table = await loadDiariaTable(ana, DETALLE_ID, day, now);
    const mine = table.table.find((row) => row.me)!;
    assert.equal(mine.score, 10);
    assert.equal(mine.place, 1);
    assert.ok(table.table.some((row) => row.name === "Beto" && !row.finished));
    // Nothing answered in the game writes to the library.
    assert.equal((await db.query.titles.findMany({ where: eq(titles.userId, ana) })).length, 0);
  });
});
