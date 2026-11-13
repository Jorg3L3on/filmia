import "@/lib/test-support/node-async-local-storage";

import assert from "node:assert/strict";
import { after, before, it } from "node:test";
import { and, eq, inArray } from "drizzle-orm";
import { catalog, db, juegoPartidas, juegoRondas, titles } from "@/db";
import { closeLocalPg } from "@/db/local-pg";
import { dailyLensOf, MAYOR_ID, MAYOR_LENSES, MAYOR_MIN_VOTES, shareText, type MayorLensId } from "@/lib/juegos/mayor/core";
import {
  answerMayor,
  loadMayorPool,
  openDailyMayor,
  openFreeMayor,
  readDailyMayor,
  readShareableDaily,
  startFreeMayor,
  type MayorSources,
  type MayorView,
} from "@/lib/juegos/mayor/store";
import { bestScoresByLens, loadDayTable } from "@/lib/juegos/partidas";
import { describeWithDb } from "@/lib/test-support/local-db";
import { seeder } from "@/lib/test-support/seed";

/** FIL-I52-2/3/4/5 · Mayor o menor on the local database, over 30 fictitious films the suite seeds. */
describeWithDb("Mayor o menor store (FIL-I52-2/3/4/5)", () => {
  const seed = seeder("t-mayor");
  // Far-off days so a re-run or the dev data never meets these rounds.
  const day1 = new Date("2031-03-04T18:00:00Z");
  const day2 = new Date("2031-03-05T18:00:00Z");
  const days = ["2031-03-04", "2031-03-05"];
  const filmIds = new Set<string>();
  const byId = new Map<string, { imdbRating: number; year: number; runtimeMinutes: number; rtScore: number; name: string }>();
  let ana = "";
  let beto = "";
  let watchedTitle = "";

  const sources: MayorSources = { pool: async (lens) => (await loadMayorPool(lens)).filter((film) => filmIds.has(film.id)) };

  const cleanRounds = () => db.delete(juegoRondas).where(and(eq(juegoRondas.juego, MAYOR_ID), inArray(juegoRondas.day, days)));

  /** The right answer of the current step, from the seeded numbers (what a cheater would need). */
  const truth = (view: MayorView) => {
    const lens = MAYOR_LENSES[view.lens];
    const left = byId.get(view.step!.left.catalogId)!;
    const right = byId.get(view.step!.right.catalogId)!;
    const a = lens.shape === "single" ? Math.round(left.imdbRating * 10) : lens.valueOf({ ...left, id: "", posterPath: "x", imdbVotes: 1 })!;
    const b = lens.shape === "single" ? right.rtScore : lens.valueOf({ ...right, id: "", posterPath: "x", imdbVotes: 1 })!;
    return b > a ? "mayor" : "menor";
  };
  const wrong = (view: MayorView) => (truth(view) === "mayor" ? "menor" : "mayor");

  /** No view may carry the hidden film's number before the answer. */
  const assertHidden = (view: MayorView) => {
    if (!view.step) return;
    assert.deepEqual(Object.keys(view.step.right).sort(), ["catalogId", "name", "posterPath"]);
    const lens = MAYOR_LENSES[view.lens];
    const right = byId.get(view.step.right.catalogId)!;
    const hidden = lens.format(lens.rightValue({ ...right, id: "", posterPath: "x", imdbVotes: 1 })!);
    const json = JSON.stringify(view);
    assert.ok(!json.includes(`"${hidden}"`), `the hidden ${hidden} travelled in the view`);
  };

  const userTitles = (userId: string) => db.query.titles.findMany({ where: eq(titles.userId, userId) });

  before(async () => {
    await cleanRounds();
    ana = await seed.user("Ana");
    beto = await seed.user("Beto");
    for (let index = 0; index < 30; index += 1) {
      const film = await seed.film({ name: `Película número ${index + 1} con un título bastante largo`, year: 1980 + index });
      const numbers = {
        imdbRating: Math.round((5.2 + index * 0.13) * 10) / 10,
        year: 1980 + ((index * 7) % 40),
        runtimeMinutes: 85 + ((index * 9) % 80),
        rtScore: (index * 37) % 100,
        name: `Película número ${index + 1} con un título bastante largo`,
      };
      await db
        .update(catalog)
        .set({ imdbRating: numbers.imdbRating, imdbVotes: MAYOR_MIN_VOTES + 10, year: numbers.year, runtimeMinutes: numbers.runtimeMinutes, rtScore: numbers.rtScore })
        .where(eq(catalog.id, film.catalogId));
      filmIds.add(film.catalogId);
      byId.set(film.catalogId, numbers);
    }
    // An obscure film never plays.
    const obscure = await seed.film({ name: "Desconocida" });
    await db.update(catalog).set({ imdbRating: 9.9, imdbVotes: 10 }).where(eq(catalog.id, obscure.catalogId));
    filmIds.add(obscure.catalogId);
    watchedTitle = await seed.title(ana, [...filmIds][0]!, { watchedAt: new Date("2026-01-01T12:00:00Z"), rating: 8 });
  });

  after(async () => {
    await cleanRounds();
    await seed.cleanup();
    await closeLocalPg();
  });

  it("the view that hands out a pair never holds the hidden rating", async () => {
    const view = (await startFreeMayor(ana, "imdb", day1, sources))!;
    assert.equal(view.mode, "libre");
    assert.ok(view.total >= 20, "a long free sequence");
    assertHidden(view);
    const outcome = await answerMayor(ana, view.partidaId, 0, truth(view), day1);
    assert.ok(outcome.ok);
    assert.equal(outcome.correct, true);
    // The answered value comes back now, and the next pair hides its own.
    assert.equal(outcome.revealed, MAYOR_LENSES.imdb.format(byId.get(view.step!.right.catalogId)!.imdbRating));
    assertHidden(outcome.view);
    assert.equal(outcome.view.step!.left.catalogId, view.step!.right.catalogId, "the right film moves left");
  });

  it("after a miss the partida is saved with its streak and the record goes up", async () => {
    let view = (await openFreeMayor(ana, "imdb", day1, sources))!;
    assert.equal(view.answers.length, 1, "the unfinished partida is picked up where it stopped");
    for (let index = 0; index < 3; index += 1) {
      const outcome = await answerMayor(ana, view.partidaId, view.step!.index, truth(view), day1);
      assert.ok(outcome.ok && outcome.correct);
      view = outcome.view;
    }
    const miss = await answerMayor(ana, view.partidaId, view.step!.index, wrong(view), day1);
    assert.ok(miss.ok);
    assert.equal(miss.correct, false);
    assert.equal(miss.view.finished, true);
    assert.equal(miss.view.score, 4);
    assert.equal(miss.view.best, 4);
    assert.equal(miss.view.step, null);
    const stored = await db.query.juegoPartidas.findFirst({ where: eq(juegoPartidas.id, view.partidaId) });
    assert.ok(stored?.finishedAt);
    assert.deepEqual(stored?.answers, [true, true, true, true, false]);
    // A finished partida takes no more answers, and a new one starts from 0 with the record kept.
    const late = await answerMayor(ana, view.partidaId, 5, "mayor", day1);
    assert.equal(late.ok, false);
    const next = (await openFreeMayor(ana, "imdb", day1, sources))!;
    assert.notEqual(next.partidaId, view.partidaId);
    assert.equal(next.score, 0);
    assert.equal(next.best, 4);
  });

  it("an answer for a step already answered, or someone else's partida, changes nothing", async () => {
    const view = (await openFreeMayor(ana, "imdb", day1, sources))!;
    const first = await answerMayor(ana, view.partidaId, 0, truth(view), day1);
    assert.ok(first.ok);
    const again = await answerMayor(ana, view.partidaId, 0, truth(view), day1);
    assert.equal(again.ok, false);
    assert.equal(again.view?.answers.length, 1);
    const stranger = await answerMayor(beto, view.partidaId, 1, "mayor", day1);
    assert.deepEqual(stranger, { ok: false, error: "No encontramos esa partida." });
  });

  it("the record is kept per lens (FIL-I52-5)", async () => {
    let view = (await startFreeMayor(ana, "runtime", day1, sources))!;
    const outcome = await answerMayor(ana, view.partidaId, 0, truth(view), day1);
    assert.ok(outcome.ok);
    view = outcome.view;
    await answerMayor(ana, view.partidaId, 1, wrong(view), day1);
    const records = await bestScoresByLens(ana, MAYOR_ID);
    assert.equal(records.get("imdb")?.best, 4);
    assert.equal(records.get("runtime")?.best, 1);
    assert.equal(records.get("year"), undefined);
    const critica = (await startFreeMayor(ana, "critica", day1, sources))!;
    assert.equal(critica.best, 0);
    assert.equal(critica.step!.left.catalogId, critica.step!.right.catalogId, "one film per step");
    assertHidden(critica);
  });

  it("two accounts get the same ten pairs on a day, and other pairs the next day", async () => {
    const a = await openDailyMayor(ana, day1, sources);
    const b = await openDailyMayor(beto, day1, sources);
    assert.equal(a.status, "ok");
    assert.equal(b.status, "ok");
    if (a.status !== "ok" || b.status !== "ok") return;
    assert.equal(a.view.total, 10);
    assert.equal(a.view.lens, dailyLensOf("2031-03-04"));
    assert.equal(b.view.lens, a.view.lens, "the same lens for everyone that day");
    assert.notEqual(a.view.partidaId, b.view.partidaId);
    const sequence = async (partidaId: string) =>
      ((await db.query.juegoPartidas.findFirst({ where: eq(juegoPartidas.id, partidaId) }))!.content as { sequence: string[] }).sequence;
    assert.deepEqual(await sequence(a.view.partidaId), await sequence(b.view.partidaId));
    assertHidden(a.view);
    const next = await openDailyMayor(ana, day2, sources);
    assert.equal(next.status, "ok");
    if (next.status !== "ok") return;
    assert.notDeepEqual(await sequence(next.view.partidaId), await sequence(a.view.partidaId));
  });

  it("the daily goes on to ten after a miss; a second open the same day shows the result, not a new partida", async () => {
    const opened = await openDailyMayor(ana, day1, sources);
    assert.equal(opened.status, "ok");
    if (opened.status !== "ok") return;
    let view = opened.view;
    for (let index = 0; index < 10; index += 1) {
      const guess = index === 2 || index === 6 ? wrong(view) : truth(view);
      const outcome = await answerMayor(ana, view.partidaId, index, guess, day1);
      assert.ok(outcome.ok, `step ${index}`);
      view = outcome.view;
      assert.equal(view.finished, index === 9);
    }
    assert.equal(view.score, 8);
    assert.deepEqual(view.answers, [true, true, false, true, true, true, false, true, true, true]);
    const reopened = await openDailyMayor(ana, day1, sources);
    assert.equal(reopened.status, "ok");
    if (reopened.status !== "ok") return;
    assert.equal(reopened.view.partidaId, view.partidaId);
    assert.equal(reopened.view.finished, true);
    assert.equal(reopened.view.step, null);
    const count = await db.$count(juegoPartidas, and(eq(juegoPartidas.userId, ana), eq(juegoPartidas.mode, "diaria"), eq(juegoPartidas.day, "2031-03-04")));
    assert.equal(count, 1);
    assert.equal((await readDailyMayor(ana, "2031-03-04"))?.score, 8);
  });

  it("the day table orders by score and carries no email", async () => {
    const opened = await openDailyMayor(beto, day1, sources);
    assert.equal(opened.status, "ok");
    if (opened.status !== "ok") return;
    let view = opened.view;
    for (let index = 0; index < 10; index += 1) {
      const outcome = await answerMayor(beto, view.partidaId, index, truth(view), day1);
      assert.ok(outcome.ok);
      view = outcome.view;
    }
    const table = await loadDayTable(MAYOR_ID, dailyLensOf("2031-03-04"), "2031-03-04");
    const ours = table.filter((row) => row.userId === ana || row.userId === beto);
    assert.deepEqual(
      ours.map((row) => [row.name, row.score, row.place]),
      [
        ["Beto", 10, 1],
        ["Ana", 8, 2],
      ],
    );
    assert.ok(!JSON.stringify(table).includes("@filmia.test"));
  });

  it("the shared result names no film of the round, and only the owner's finished daily is shareable (FIL-I52-4)", async () => {
    const opened = await openDailyMayor(ana, day1, sources);
    assert.equal(opened.status, "ok");
    if (opened.status !== "ok") return;
    const shareable = await readShareableDaily(ana, opened.view.partidaId);
    assert.ok(shareable);
    const text = shareText({ day: shareable.day, lens: shareable.lens, answers: shareable.answers, url: "https://filmia.app/extras" });
    const sequence = ((await db.query.juegoPartidas.findFirst({ where: eq(juegoPartidas.id, opened.view.partidaId) }))!.content as { sequence: string[] }).sequence;
    assert.equal(sequence.length, 11);
    for (const id of sequence) {
      assert.ok(!text.includes(byId.get(id)!.name));
    }
    assert.ok(!text.includes("Película"), "no title of the round");
    assert.match(text, /^Filmia · Mayor o menor n\.º \d+ · .+\n8 de 10\n(🟩|🟥){10}\nhttps:\/\/filmia\.app\/extras$/u);
    // Someone else's, an unfinished one, a free streak or a made-up id: nothing.
    assert.equal(await readShareableDaily(beto, opened.view.partidaId), null);
    const unfinished = await openDailyMayor(beto, day2, sources);
    assert.equal(unfinished.status, "ok");
    if (unfinished.status === "ok") assert.equal(await readShareableDaily(beto, unfinished.view.partidaId), null);
    const free = (await openFreeMayor(ana, "imdb", day1, sources))!;
    assert.equal(await readShareableDaily(ana, free.partidaId), null);
    assert.equal(await readShareableDaily(ana, "no-existe"), null);
  });

  it("playing never writes to Title", async () => {
    const mine = await userTitles(ana);
    assert.equal(mine.length, 1);
    assert.equal(mine[0]!.id, watchedTitle);
    assert.equal(mine[0]!.rating, 8);
    assert.equal((await userTitles(beto)).length, 0);
    const onPool = await db.query.titles.findMany({ where: inArray(titles.catalogId, [...filmIds]) });
    assert.deepEqual(onPool.map((row) => row.id), [watchedTitle]);
    assert.equal(mine[0]!.updatedAt.getTime(), (await userTitles(ana))[0]!.updatedAt.getTime());
  });

  it("each lens's pool from the database only has films with that number", async () => {
    for (const lens of Object.keys(MAYOR_LENSES) as MayorLensId[]) {
      const pool = await sources.pool(lens);
      assert.equal(pool.length, 30, `${lens}: the obscure film is out`);
    }
  });
});
