import "@/lib/test-support/node-async-local-storage";

import assert from "node:assert/strict";
import { after, before, it } from "node:test";
import { createId } from "@paralleldrive/cuid2";
import { and, eq, inArray } from "drizzle-orm";
import { db, pickEvents, pushSubscriptions } from "@/db";
import { closeLocalPg } from "@/db/local-pg";
import type { Juego } from "@/lib/juegos/core";
import { RETO_PUSH_KIND } from "@/lib/juegos/push";
import { selectJuegosPushTargets, setJuegosPushFor } from "@/lib/juegos/push-store";
import { notifyRetado, setRetosPushFor, type RetoPushSender } from "@/lib/juegos/retos/push-store";
import { describeWithDb } from "@/lib/test-support/local-db";
import { seeder } from "@/lib/test-support/seed";

/** FIL-I53-3 · «te retaron» on the local database, with a fake sender (no real push leaves). */
describeWithDb("«Te retaron» (FIL-I53-3)", () => {
  const seed = seeder("t-retopush");
  const now = new Date("2031-06-01T18:00:00Z");
  let ana = "";
  let beto = "";
  let carla = "";
  const delivered: string[] = [];
  const send: RetoPushSender = async (subscription, payload) => {
    delivered.push(`${subscription.endpoint}|${payload.title}`);
    return "sent";
  };
  const reto = (to: string) => ({ id: createId(), juego: "trivia", fromUserId: ana, toUserId: to });
  const subscribe = (userId: string) =>
    db.insert(pushSubscriptions).values({ id: createId(), userId, endpoint: `https://push.test/${userId}`, p256dh: "k", auth: "a" });

  before(async () => {
    ana = await seed.user("Ana");
    beto = await seed.user("Beto");
    carla = await seed.user("Carla");
    await subscribe(beto);
    await subscribe(carla);
  });

  after(async () => {
    await db.delete(pickEvents).where(and(inArray(pickEvents.userId, [ana, beto, carla]), eq(pickEvents.kind, RETO_PUSH_KIND)));
    await seed.cleanup();
    await closeLocalPg();
  });

  it("two retos the same day send one push; the next day sends again", async () => {
    delivered.length = 0;
    assert.equal(await notifyRetado(reto(beto), now, { send }), "sent");
    assert.equal(await notifyRetado(reto(beto), new Date(now.getTime() + 60_000), { send }), "skipped");
    assert.deepEqual(delivered, [`https://push.test/${beto}|Ana te retó`]);
    assert.equal(await notifyRetado(reto(beto), new Date(now.getTime() + 24 * 3_600_000), { send }), "sent");
    assert.equal(delivered.length, 2);
  });

  it("with «Te retaron» off no push leaves, and «Avisos de Extras» stays as it was", async () => {
    delivered.length = 0;
    await setRetosPushFor(carla, false);
    assert.equal(await notifyRetado(reto(carla), now, { send }), "skipped");
    assert.equal(delivered.length, 0);
    // The weekly Extras push still selects Carla: the other switch is untouched.
    const tanda: Juego = { id: "tanda", name: "La tanda", line: "", status: "available", href: "/extras/tanda", launchedOn: "2026-11-12", seasons: null };
    const targets = await selectJuegosPushTargets(now, [tanda]);
    assert.ok(targets.some((target) => target.userId === carla));
    // And the other way round: Extras off, «Te retaron» on, the reto pushes.
    await setRetosPushFor(carla, true);
    await setJuegosPushFor(carla, false);
    assert.equal(await notifyRetado(reto(carla), now, { send }), "sent");
    assert.ok(!(await selectJuegosPushTargets(now, [tanda])).some((target) => target.userId === carla));
  });

  it("a link reto (no account) never pushes", async () => {
    assert.equal(await notifyRetado({ id: createId(), juego: "mayor", fromUserId: ana, toUserId: null }, now, { send }), "skipped");
  });
});
