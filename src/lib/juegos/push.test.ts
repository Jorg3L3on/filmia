import "@/lib/test-support/node-async-local-storage";

import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createId } from "@paralleldrive/cuid2";
import { eq } from "drizzle-orm";
import { db, pickEvents, pushSubscriptions, users } from "@/db";
import { closeLocalPg } from "@/db/local-pg";
import { JUEGOS, type Juego } from "@/lib/juegos/core";
import { juegosPushPayload, juegosPushPlan, launchPushLens, recentLaunches, tandaPushLens, JUEGOS_PUSH_KIND } from "@/lib/juegos/push";
import { selectJuegosPushTargets, sendJuegosPushes, setJuegosPushFor } from "@/lib/juegos/push-store";
import { juegosMetrics, partidasMetrics } from "@/lib/juegos/metrics";
import { describeWithDb } from "@/lib/test-support/local-db";
import { seeder } from "@/lib/test-support/seed";

const tanda: Juego = {
  id: "tanda",
  name: "La tanda",
  line: "Diez cartas",
  status: "available",
  href: "/extras/tanda",
  launchedOn: "2026-11-12",
  seasons: null,
};
const person = (overrides: Partial<Parameters<typeof juegosPushPlan>[0]> = {}) => ({
  juegosPush: true,
  hasSubscription: true,
  openedTandaThisWeek: false,
  sent: new Set<string>(),
  ...overrides,
});
const week = "2026-11-23";
const today = "2026-11-24";

describe("Avisos de Juegos: who gets what (FIL-I50-5)", () => {
  it("respects the switch and needs a device", () => {
    assert.equal(juegosPushPlan(person({ juegosPush: false }), { week, today, juegos: [tanda] }), null);
    assert.equal(juegosPushPlan(person({ hasSubscription: false }), { week, today, juegos: [tanda] }), null);
  });

  it("one tanda push a week, skipped by whom already opened it", () => {
    assert.deepEqual(juegosPushPlan(person(), { week, today, juegos: [tanda] }), { kind: "tanda" });
    assert.equal(juegosPushPlan(person({ openedTandaThisWeek: true }), { week, today, juegos: [tanda] }), null);
    assert.equal(juegosPushPlan(person({ sent: new Set([tandaPushLens(week)]) }), { week, today, juegos: [tanda] }), null);
  });

  it("one push per launch, while the launch is news, before the tanda", () => {
    const muro: Juego = { ...tanda, id: "muro", name: "El muro", href: "/extras/muro", launchedOn: "2026-11-24" };
    assert.deepEqual(juegosPushPlan(person(), { week, today, juegos: [tanda, muro] }), { kind: "launch", juego: muro });
    assert.deepEqual(juegosPushPlan(person({ sent: new Set([launchPushLens("muro")]) }), { week, today, juegos: [tanda, muro] }), {
      kind: "tanda",
    });
    assert.deepEqual(recentLaunches([muro], "2026-12-01"), []);
  });

  it("Mayor o menor's launch goes once per person, after La tanda's (FIL-I52-6)", () => {
    const input = { week: "2026-11-09", today: "2026-11-14", juegos: JUEGOS };
    const mayor = JUEGOS.find((item) => item.id === "mayor")!;
    const afterTanda = person({ sent: new Set([launchPushLens("tanda")]) });
    assert.deepEqual(juegosPushPlan(afterTanda, input), { kind: "launch", juego: mayor });
    const payload = juegosPushPayload({ kind: "launch", juego: mayor }, "");
    assert.equal(payload.title, "Nuevo en Extras: Mayor o menor");
    assert.equal(payload.url, "/extras/mayor-o-menor");
    // Once sent, never again; a week later the launch is no longer news.
    const both = person({ sent: new Set([launchPushLens("tanda"), launchPushLens("mayor"), tandaPushLens("2026-11-09")]) });
    assert.equal(juegosPushPlan(both, input), null);
    assert.ok(!recentLaunches(JUEGOS, "2026-11-20").some((item) => item.id === "mayor"));
  });

  it("says it without guilt or urgency", () => {
    const payload = juegosPushPayload({ kind: "tanda" }, "2001–2015");
    assert.equal(payload.title, "Tu tanda de la semana ya está");
    assert.equal(payload.url, "/extras/tanda");
    assert.doesNotMatch(`${payload.title} ${payload.body}`, /no te pierdas|última|rápido|ya casi|racha|!/i);
  });
});

describe("Partidas metrics (FIL-I52-6)", () => {
  it("counts finished dailies, answered free partidas and distinct people per week", () => {
    const at = (day: string) => new Date(`${day}T18:00:00Z`);
    const rows = [
      { userId: "a", juego: "mayor", mode: "diaria", answered: 10, startedAt: at("2026-11-16"), finishedAt: at("2026-11-16") },
      { userId: "b", juego: "mayor", mode: "diaria", answered: 10, startedAt: at("2026-11-16"), finishedAt: at("2026-11-16") },
      { userId: "b", juego: "mayor", mode: "diaria", answered: 4, startedAt: at("2026-11-17"), finishedAt: null },
      { userId: "a", juego: "mayor", mode: "libre", answered: 3, startedAt: at("2026-11-18"), finishedAt: at("2026-11-18") },
      { userId: "c", juego: "mayor", mode: "libre", answered: 0, startedAt: at("2026-11-18"), finishedAt: null },
      { userId: "a", juego: "mayor", mode: "diaria", answered: 10, startedAt: at("2026-11-24"), finishedAt: at("2026-11-24") },
    ];
    assert.deepEqual(partidasMetrics(rows, ["2026-11-16", "2026-11-23"]), [
      { week: "2026-11-16", juego: "mayor", daily: 2, free: 1, players: 2 },
      { week: "2026-11-23", juego: "mayor", daily: 1, free: 0, players: 1 },
    ]);
    assert.deepEqual(partidasMetrics([], ["2026-11-16"]), []);
  });
});

describe("Juegos metrics (FIL-I50-6)", () => {
  it("counts visits by door, tandas started and finished, and returns", () => {
    const at = (iso: string) => new Date(iso);
    const events = [
      { userId: "a", kind: "juegos_opened", lens: "boton", createdAt: at("2026-11-17T18:00:00Z") },
      { userId: "b", kind: "juegos_opened", lens: "bloque", createdAt: at("2026-11-18T18:00:00Z") },
      ...Array.from({ length: 10 }, () => ({ userId: "a", kind: "tanda_dealt", lens: "2026-11-16|p", createdAt: at("2026-11-17T18:00:00Z") })),
      ...Array.from({ length: 10 }, (_, i) => ({ userId: "a", kind: "tanda_answered", lens: `2026-11-16|liked|new`, createdAt: at(`2026-11-17T18:0${i % 10}:00Z`) })),
      ...Array.from({ length: 10 }, () => ({ userId: "b", kind: "tanda_dealt", lens: "2026-11-16|p", createdAt: at("2026-11-18T18:00:00Z") })),
      { userId: "b", kind: "tanda_answered", lens: "2026-11-16|no|old", createdAt: at("2026-11-18T18:01:00Z") },
      { userId: "a", kind: "juegos_opened", lens: "boton", createdAt: at("2026-11-24T18:00:00Z") },
    ];
    const [first, second] = juegosMetrics(events, ["2026-11-16", "2026-11-23"], "2026-11-30");
    assert.deepEqual(first, { week: "2026-11-16", visits: 2, viaBoton: 1, viaBloque: 1, started: 2, finished: 1, returned7d: 1 });
    assert.equal(second?.returned7d, null, "the next week is not over");
  });
});

describeWithDb("Avisos de Juegos on the database (FIL-I50-5)", () => {
  const seed = seeder("t-juegos-push");
  const now = new Date("2026-11-24T15:00:00Z");
  let fresh = "";
  let opened = "";
  let off = "";
  let bare = "";

  const subscribe = async (userId: string) => {
    await db.insert(pushSubscriptions).values({ id: createId(), userId, endpoint: `https://push.invalid/${userId}`, p256dh: "k", auth: "a" });
  };

  before(async () => {
    fresh = await seed.user("Fresca");
    opened = await seed.user("Abrió");
    off = await seed.user("Apagó");
    bare = await seed.user("SinDispositivo");
    for (const userId of [fresh, opened, off]) await subscribe(userId);
    await db.insert(pickEvents).values({ id: createId(), userId: opened, kind: "tanda_dealt", lens: "2026-11-23|p", createdAt: now });
    // Launch pushes for La tanda already went out: this test is about the weekly one.
    for (const userId of [fresh, opened, off]) {
      await db.insert(pickEvents).values({ id: createId(), userId, kind: JUEGOS_PUSH_KIND, lens: launchPushLens("tanda"), createdAt: new Date("2026-11-12T16:00:00Z") });
    }
    await setJuegosPushFor(off, false);
  });

  after(async () => {
    await seed.cleanup();
    await closeLocalPg();
  });

  it("selects only who has it on, a device, and has not opened the week's tanda", async () => {
    const targets = (await selectJuegosPushTargets(now)).filter((target) => [fresh, opened, off, bare].includes(target.userId));
    assert.deepEqual(targets, [{ userId: fresh, plan: { kind: "tanda" } }]);
  });

  it("turning «Avisos de Juegos» off keeps the device's other avisos", async () => {
    const rows = await db.query.pushSubscriptions.findMany({ where: eq(pushSubscriptions.userId, off) });
    assert.equal(rows.length, 1);
    const user = await db.query.users.findFirst({ where: eq(users.id, off), columns: { juegosPush: true } });
    assert.equal(user?.juegosPush, false);
  });

  it("a dry run sends and writes nothing", async () => {
    const before = await db.$count(pickEvents, eq(pickEvents.kind, JUEGOS_PUSH_KIND));
    const summary = await sendJuegosPushes(now, { dryRun: true });
    assert.equal(summary.dryRun, true);
    assert.ok(summary.targets >= 1);
    assert.equal(await db.$count(pickEvents, eq(pickEvents.kind, JUEGOS_PUSH_KIND)), before);
  });

  it("the cap: once sent this week (or today), nobody is selected again", async () => {
    await db.insert(pickEvents).values({ id: createId(), userId: fresh, kind: JUEGOS_PUSH_KIND, lens: tandaPushLens("2026-11-23"), createdAt: now });
    const targets = (await selectJuegosPushTargets(new Date("2026-11-26T15:00:00Z"))).filter((target) => target.userId === fresh);
    assert.deepEqual(targets, []);
  });
});
