import "@/lib/test-support/local-db";

import assert from "node:assert/strict";
import { after, before, it } from "node:test";
import { createId } from "@paralleldrive/cuid2";
import { inArray } from "drizzle-orm";
import { db, juegoPartidas, juegoRetos } from "@/db";
import { loadLiga, ligaSummaryFor } from "@/lib/juegos/liga/store";
import { describeWithDb } from "@/lib/test-support/local-db";
import { seeder } from "@/lib/test-support/seed";

/** FIL-I55-3 · the league on the local database, around the Sunday→Monday boundary of 2033-12-26. */
describeWithDb("La liga de la semana (FIL-I55-3)", () => {
  const seed = seeder("t-liga");
  const sunday2359 = new Date("2034-01-02T05:59:00Z");
  const monday0001 = new Date("2034-01-02T06:01:00Z");
  const midweek = new Date("2033-12-28T18:00:00Z");
  /** «Now» on Tuesday of the second week: «semana» = from 2034-01-02, «pasada» = 2033-12-26. */
  const now = new Date("2034-01-03T18:00:00Z");
  const partidaIds: string[] = [];
  const retoIds: string[] = [];
  let ana = "";
  let beto = "";
  let caro = "";
  let dani = "";

  const daily = async (userId: string, score: number, finishedAt: Date, day: string, juego = "mayor") => {
    const id = createId();
    partidaIds.push(id);
    await db.insert(juegoPartidas).values({ id, userId, juego, mode: "diaria", lens: "imdb", day, content: {}, answers: [], score, startedAt: finishedAt, updatedAt: finishedAt, finishedAt });
    return id;
  };
  const retoPartida = async (userId: string, score: number, finishedAt: Date) => {
    const id = createId();
    partidaIds.push(id);
    await db.insert(juegoPartidas).values({ id, userId, juego: "trivia", mode: "reto", lens: "trivia", content: {}, answers: [], score, startedAt: finishedAt, updatedAt: finishedAt, finishedAt });
    return id;
  };
  const reto = async (from: string, to: string | null, fromScore: number, toScore: number, finishedAt: Date) => {
    const id = createId();
    retoIds.push(id);
    await db.insert(juegoRetos).values({
      id,
      juego: "trivia",
      lens: "trivia",
      seed: id,
      content: {},
      fromUserId: from,
      toUserId: to,
      fromPartidaId: await retoPartida(from, fromScore, finishedAt),
      toPartidaId: to ? await retoPartida(to, toScore, finishedAt) : null,
      status: "jugado",
      createdAt: finishedAt,
      sentAt: finishedAt,
      expiresAt: new Date(finishedAt.getTime() + 48 * 3_600_000),
      finishedAt,
    });
  };

  before(async () => {
    ana = await seed.user("Ana Ruiz");
    beto = await seed.user("Beto");
    caro = await seed.user("Carolina");
    dani = await seed.user("Dani"); // never plays
    // Week of 2033-12-26.
    await daily(ana, 8, midweek, "2033-12-28"); // 80
    await daily(ana, 10, sunday2359, "2034-01-01"); // 100, Sunday 23:59
    await reto(ana, beto, 300, 200, midweek); // Ana 60, Beto 20
    await reto(beto, null, 999, 0, midweek); // a link reto: never counts
    // Week of 2034-01-02.
    await daily(beto, 5, monday0001, "2034-01-02"); // 50, Monday 00:01
    await reto(caro, beto, 100, 100, monday0001); // tie: 40 each
  });

  after(async () => {
    if (retoIds.length) await db.delete(juegoRetos).where(inArray(juegoRetos.id, retoIds));
    if (partidaIds.length) await db.delete(juegoPartidas).where(inArray(juegoPartidas.id, partidaIds));
    await seed.cleanup();
  });

  const mine = (rows: Awaited<ReturnType<typeof loadLiga>>["rows"]) =>
    rows.filter((row) => [ana, beto, caro, dani].includes(row.userId)).map((row) => [row.name, row.points]);

  it("points of a fixed week match the rules table", async () => {
    const { week, rows } = await loadLiga(ana, "pasada", now);
    assert.equal(week, "2033-12-26");
    assert.deepEqual(mine(rows), [
      ["Tú", 240],
      ["Beto", 20],
    ]);
  });

  it("Sunday 23:59 and Monday 00:01 (Mexico City) land in different weeks", async () => {
    const last = await loadLiga(beto, "pasada", now);
    const current = await loadLiga(beto, "semana", now);
    assert.equal(current.week, "2034-01-02");
    // Ana's Sunday 23:59 daily is in last week (240 includes its 100); Beto's Monday 00:01 daily is this week's.
    assert.ok(mine(last.rows).some(([name, points]) => name === "Ana" && points === 240));
    assert.deepEqual(mine(current.rows), [
      ["Tú", 90],
      ["Carolina", 40],
    ]);
  });

  it("nobody who did not play, never an email", async () => {
    for (const tab of ["semana", "pasada", "historico"] as const) {
      const { rows } = await loadLiga(dani, tab, now);
      assert.ok(!rows.some((row) => row.userId === dani), `${tab}: Dani did not play`);
      const text = JSON.stringify(rows);
      assert.ok(!text.includes("@"), `${tab}: no email`);
      assert.ok(!text.includes("Ruiz"), `${tab}: first name only`);
    }
    assert.equal(await ligaSummaryFor(dani, now), null);
    const summary = await ligaSummaryFor(caro, now);
    assert.deepEqual(summary && { place: summary.place, points: summary.points, ahead: summary.ahead }, { place: 2, points: 40, ahead: { name: "Beto", gap: 50 } });
  });
});
