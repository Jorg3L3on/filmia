import "@/lib/test-support/node-async-local-storage";

import assert from "node:assert/strict";
import { after, before, it } from "node:test";
import { eq } from "drizzle-orm";
import { db, juegoRondas } from "@/db";
import { closeLocalPg } from "@/db/local-pg";
import {
  bestScore,
  createPartida,
  DailyTakenError,
  displayNameOf,
  finishedDailyDays,
  getOrCreateRonda,
  loadDayTable,
  rankDayTable,
  readDailyPartida,
  readPartida,
  recordAnswer,
} from "@/lib/juegos/partidas";
import { describeWithDb } from "@/lib/test-support/local-db";
import { seeder } from "@/lib/test-support/seed";

/** FIL-I52-1 · the partida engine on the local database. Each run uses its own game id. */
describeWithDb("Partidas de Extras (FIL-I52-1)", () => {
  const seed = seeder("t-partidas");
  const juego = `prueba-${Date.now().toString(36)}`;
  const day = "2026-11-20";
  let ana = "";
  let beto = "";

  before(async () => {
    ana = await seed.user("Ana");
    beto = await seed.user("Beto Ruiz");
  });

  after(async () => {
    await db.delete(juegoRondas).where(eq(juegoRondas.juego, juego));
    await seed.cleanup();
    await closeLocalPg();
  });

  it("a day's round is made once: a second open reads the same row and never builds again", async () => {
    let builds = 0;
    const build = () => {
      builds += 1;
      return { sequence: ["a", "b"] };
    };
    const first = await getOrCreateRonda({ juego, lens: "imdb", day, seed: "s", build });
    const second = await getOrCreateRonda({ juego, lens: "imdb", day, seed: "s", build: () => ({ sequence: ["x"] }) });
    assert.equal(second.id, first.id);
    assert.deepEqual(second.content, { sequence: ["a", "b"] });
    assert.equal(builds, 1);
  });

  it("a second daily of the same person, game, lens and day is rejected", async () => {
    const partida = await createPartida({ userId: ana, juego, mode: "diaria", lens: "imdb", day, content: { sequence: [] } });
    await assert.rejects(
      createPartida({ userId: ana, juego, mode: "diaria", lens: "imdb", day, content: { sequence: [] } }),
      DailyTakenError,
    );
    assert.equal((await readDailyPartida(ana, juego, "imdb", day))?.id, partida.id);
    // Another lens, another day or another person is a different daily; free partidas are unlimited.
    await createPartida({ userId: ana, juego, mode: "diaria", lens: "year", day, content: {} });
    await createPartida({ userId: ana, juego, mode: "diaria", lens: "imdb", day: "2026-11-21", content: {} });
    await createPartida({ userId: beto, juego, mode: "diaria", lens: "imdb", day, content: {} });
    await createPartida({ userId: ana, juego, mode: "libre", lens: "imdb", content: {} });
    await createPartida({ userId: ana, juego, mode: "libre", lens: "imdb", content: {} });
  });

  it("an answer counts once: the second write of the same step loses", async () => {
    const partida = await createPartida({ userId: ana, juego, mode: "libre", lens: "runtime", content: {} });
    assert.equal(await recordAnswer({ partida, answer: true, score: 1, finished: false }), true);
    assert.equal(await recordAnswer({ partida, answer: true, score: 1, finished: false }), false);
    const stored = (await readPartida(ana, partida.id))!;
    assert.deepEqual(stored.answers, [true]);
    assert.equal(stored.score, 1);
    assert.equal(await readPartida(beto, partida.id), undefined, "someone else's partida is not readable");
    assert.equal(await recordAnswer({ partida: stored, answer: false, score: 1, finished: true }), true);
    assert.equal(await recordAnswer({ partida: { ...stored, answers: [true, false] }, answer: true, score: 2, finished: false }), false);
    assert.equal(await bestScore(ana, juego, "libre", "runtime"), 1);
    assert.equal(await bestScore(beto, juego, "libre", "runtime"), 0);
  });

  it("the day table ranks finished partidas by score, names without email, ties share a place", async () => {
    const mine = (await readDailyPartida(ana, juego, "imdb", day))!;
    await recordAnswer({ partida: mine, answer: true, score: 7, finished: true, now: new Date("2026-11-20T18:00:00Z") });
    const his = (await readDailyPartida(beto, juego, "imdb", day))!;
    await recordAnswer({ partida: his, answer: true, score: 9, finished: true, now: new Date("2026-11-20T19:00:00Z") });
    const table = await loadDayTable(juego, "imdb", day);
    assert.deepEqual(
      table.map((row) => [row.name, row.score, row.place]),
      [
        ["Beto", 9, 1],
        ["Ana", 7, 2],
      ],
    );
    assert.ok(!JSON.stringify(table).includes("@"), "no email on the table");
    assert.deepEqual(await finishedDailyDays(ana, juego), [day]);
  });
});

it("ranking and names are pure (FIL-I52-3)", () => {
  const at = (hour: number) => new Date(`2026-11-20T${String(hour).padStart(2, "0")}:00:00Z`);
  const ranked = rankDayTable([
    { id: "a", score: 8, finishedAt: at(10) },
    { id: "b", score: 9, finishedAt: at(12) },
    { id: "c", score: 8, finishedAt: at(9) },
    { id: "d", score: 3, finishedAt: null },
  ]);
  assert.deepEqual(
    ranked.map(({ row, place }) => [row.id, place]),
    [
      ["b", 1],
      ["c", 2],
      ["a", 2],
      ["d", null],
    ],
  );
  assert.equal(displayNameOf("  María José  López "), "María");
  assert.equal(displayNameOf(null), "Alguien");
});
