import "@/lib/test-support/node-async-local-storage";

import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { inArray } from "drizzle-orm";
import { catalog, db, juegoRetos, users } from "@/db";
import { closeLocalPg } from "@/db/local-pg";
import { MAYOR_ID, MAYOR_MIN_VOTES } from "@/lib/juegos/mayor/core";
import { createPartida, finishPartida, recordAnswer } from "@/lib/juegos/partidas";
import { RETO_MS } from "@/lib/juegos/retos/core";
import { answerLinkReto, createLinkReto, hashRetoToken, loadLinkReto, newRetoToken } from "@/lib/juegos/retos/link";
import { isRetoLinkOpen, retoLinkGate } from "@/lib/juegos/retos/link-gate";
import { postgresRetoLinkLookup } from "@/lib/juegos/retos/link-lookup";
import { listMyRetos, readReto } from "@/lib/juegos/retos/store";
import { isPublicPath } from "@/proxy";
import { memoryRateLimitStore, RATE_LIMITS } from "@/lib/rate-limit";
import { describeWithDb } from "@/lib/test-support/local-db";
import { seeder } from "@/lib/test-support/seed";

describe("Reto por enlace: the door (FIL-I53-4)", () => {
  it("the link is outside the session wall, the app's retos are not", () => {
    assert.equal(isPublicPath("/reto/abc"), true);
    assert.equal(isPublicPath("/extras/retos/abc"), false);
    assert.equal(isPublicPath("/retos"), false);
  });

  it("past the limit of opens per IP the route answers 429", async () => {
    const store = memoryRateLimitStore();
    const open = () => retoLinkGate(new Request("https://filmia.test/reto/x", { headers: { "x-forwarded-for": "203.0.113.9" } }), store, null);
    for (let attempt = 0; attempt < RATE_LIMITS.retoLinkIp.limit; attempt += 1) assert.equal(await open(), null);
    const blocked = (await open())!;
    assert.equal(blocked.status, 429);
    assert.ok(Number(blocked.headers.get("retry-after")) > 0);
    // Another IP is not affected; answers (POST) are not counted.
    assert.equal(await retoLinkGate(new Request("https://filmia.test/reto/x", { headers: { "x-forwarded-for": "198.51.100.1" } }), store, null), null);
    assert.equal(isRetoLinkOpen("/reto/x", "POST"), false);
  });

  it("an unknown or malformed token is a real 404 before the page streams", async () => {
    const store = memoryRateLimitStore();
    const live = newRetoToken();
    const lookup = async (hash: string) => hash === hashRetoToken(live);
    const at = (path: string) => retoLinkGate(new Request(`https://filmia.test${path}`, { headers: { "x-forwarded-for": "192.0.2.1" } }), store, lookup);
    assert.equal(await at(`/reto/${live}`), null);
    assert.equal((await at(`/reto/${newRetoToken()}`))!.status, 404);
    assert.equal((await at("/reto/corto"))!.status, 404);
    const body = await (await at("/reto/corto"))!.text();
    assert.match(body, /ya no está disponible/);
  });

  it("tokens are long and random; only their hash is kept", () => {
    const token = newRetoToken();
    assert.equal(token.length, 43);
    assert.notEqual(token, newRetoToken());
    assert.match(hashRetoToken(token), /^[0-9a-f]{64}$/);
  });
});

describeWithDb("Reto por enlace (FIL-I53-4)", () => {
  const seed = seeder("t-enlace");
  const t0 = new Date("2031-08-01T18:00:00Z");
  const films: string[] = [];
  const ratingOf = new Map<string, number>();
  let ana = "";
  const retoIds: string[] = [];

  const finishedStreak = async (score: number) => {
    const partida = await createPartida({ userId: ana, juego: MAYOR_ID, mode: "libre", lens: "imdb", content: { sequence: films }, now: t0 });
    await recordAnswer({ partida, answer: true, score, finished: true, now: t0 });
    await finishPartida(partida.id, t0);
    return partida.id;
  };

  before(async () => {
    ana = await seed.user("Ana");
    await db.update(users).set({ name: "Ana Secreta Apellidez" }).where(inArray(users.id, [ana]));
    for (let index = 0; index < 8; index += 1) {
      const film = await seed.film({ name: `Enlace ${index + 1}` });
      const rating = 5 + index * 0.4 + (index % 2 ? 0.9 : 0);
      ratingOf.set(film.catalogId, Math.round(rating * 10) / 10);
      await db.update(catalog).set({ imdbRating: Math.round(rating * 10) / 10, imdbVotes: MAYOR_MIN_VOTES + 1 }).where(inArray(catalog.id, [film.catalogId]));
      films.push(film.catalogId);
    }
  });

  after(async () => {
    if (retoIds.length) await db.delete(juegoRetos).where(inArray(juegoRetos.id, retoIds));
    await seed.cleanup();
    await closeLocalPg();
  });

  it("a valid token opens without a session; an invented or expired one does not", async () => {
    const { reto, token, path } = await createLinkReto(ana, await finishedStreak(1), t0);
    retoIds.push(reto.id);
    assert.equal(path, `/reto/${token}`);
    assert.equal((await readReto(reto.id))!.linkTokenHash, hashRetoToken(token));
    assert.ok(await loadLinkReto(token, t0));
    assert.equal(await loadLinkReto(newRetoToken(), t0), null);
    assert.equal(await loadLinkReto("../../etc", t0), null);
    assert.equal(await loadLinkReto(token, new Date(t0.getTime() + RETO_MS)), null);
    // The proxy's lookup agrees, so the route answers a real 404 for the other two.
    assert.equal(await postgresRetoLinkLookup(hashRetoToken(token), t0), true);
    assert.equal(await postgresRetoLinkLookup(hashRetoToken(newRetoToken()), t0), false);
    assert.equal(await postgresRetoLinkLookup(hashRetoToken(token), new Date(t0.getTime() + RETO_MS)), false);
  });

  it("the public view shows the sender's first name only, never their email or surname", async () => {
    const { reto, token } = await createLinkReto(ana, await finishedStreak(1), t0);
    retoIds.push(reto.id);
    const view = (await loadLinkReto(token, t0))!;
    assert.equal(view.fromName, "Ana");
    const json = JSON.stringify(view);
    assert.ok(!json.includes("Secreta") && !json.includes("Apellidez") && !json.includes("@"));
    // And the hidden value is not there before the answer.
    assert.deepEqual(Object.keys(view.step!.right).sort(), ["catalogId", "name", "posterPath"]);
  });

  it("the guest plays the same sequence; the result is kept on the token and counts as played", async () => {
    const { reto, token } = await createLinkReto(ana, await finishedStreak(1), t0);
    retoIds.push(reto.id);
    let view = (await loadLinkReto(token, t0))!;
    assert.deepEqual([view.step!.left.catalogId, view.step!.right.catalogId], [films[0], films[1]]);
    const truth = () => (ratingOf.get(view.step!.right.catalogId)! > ratingOf.get(view.step!.left.catalogId)! ? "mayor" : "menor");
    const right = await answerLinkReto(token, 0, truth(), t0);
    assert.ok(right.ok && right.correct);
    view = right.ok ? right.view : view;
    const wrong = await answerLinkReto(token, 1, truth() === "mayor" ? "menor" : "mayor", t0);
    assert.ok(wrong.ok && !wrong.correct && wrong.view.finished);
    // A replayed answer changes nothing.
    assert.equal((await answerLinkReto(token, 1, "mayor", t0)).ok, false);
    const stored = (await readReto(reto.id))!;
    assert.equal(stored.status, "jugado");
    assert.deepEqual((stored.linkResult as { answers: boolean[] }).answers, [true, false]);
    // The sender sees it among their retos, as a tie at 1.
    const mine = (await listMyRetos(ana, t0)).find((item) => item.retoId === reto.id)!;
    assert.equal(mine.otherName, "Enlace");
    assert.equal(mine.state, "empate");
  });
});
