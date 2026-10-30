import { describeWithDb } from "@/lib/test-support/local-db";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { eq } from "drizzle-orm";
import { db, users } from "@/db";
import { closeLocalPg } from "@/db/local-pg";
import { LAST_ACTIVE_EVERY_MS, shouldTouchLastActive, writeLastActive } from "@/lib/last-active";
import { seeder } from "@/lib/test-support/seed";

const MINUTE = 60_000;

describe("Última actividad · ventana (FIL-I37-2)", () => {
  it("touches a user never seen, or seen 15 min ago or more", () => {
    const now = Date.parse("2026-10-29T20:00:00Z");
    assert.equal(LAST_ACTIVE_EVERY_MS, 15 * MINUTE);
    assert.equal(shouldTouchLastActive(undefined, now), true);
    assert.equal(shouldTouchLastActive(null, now), true);
    assert.equal(shouldTouchLastActive(now - 14 * MINUTE, now), false);
    assert.equal(shouldTouchLastActive(now - 15 * MINUTE, now), true);
  });
});

const seed = seeder("activo");

describeWithDb("Última actividad · UPDATE condicional (FIL-I37-2)", () => {
  let userId = "";

  before(async () => {
    userId = await seed.user("Activa");
  });

  after(async () => {
    await seed.cleanup();
    await closeLocalPg();
  });

  const lastActive = async () =>
    (await db.query.users.findFirst({ where: eq(users.id, userId), columns: { lastActiveAt: true } }))?.lastActiveAt;

  it("writes the first time, not again within 15 min, again after", async () => {
    const first = new Date("2026-10-29T20:00:00.000Z");
    await writeLastActive(userId, first);
    assert.equal((await lastActive())?.toISOString(), first.toISOString());

    await writeLastActive(userId, new Date(first.getTime() + 14 * MINUTE));
    assert.equal((await lastActive())?.toISOString(), first.toISOString(), "not rewritten within 15 min");

    const later = new Date(first.getTime() + 16 * MINUTE);
    await writeLastActive(userId, later);
    assert.equal((await lastActive())?.toISOString(), later.toISOString());
  });
});
