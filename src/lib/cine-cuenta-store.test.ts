import { describeWithDb } from "@/lib/test-support/local-db";
import assert from "node:assert/strict";
import { after, before, it } from "node:test";
import { eq } from "drizzle-orm";
import { catalog, cinemaReleases, db, pickEvents, pushSubscriptions } from "@/db";
import { closeLocalPg } from "@/db/local-pg";
import { seeder } from "@/lib/test-support/seed";
import { loadCountdowns, notifyPremiereReminders, remindPremiere } from "./cine-cuenta-store";

const seed = seeder("cuenta");

describeWithDb("Cuenta regresiva · store (FIL-I26-5)", () => {
  let userId = "";
  let stranger = "";
  let duna3 = "";

  before(async () => {
    userId = await seed.user("Ivan");
    stranger = await seed.user("Otra");
    const duna = await seed.film({ name: "Duna" });
    await db.update(catalog).set({ tmdbPeople: [{ id: 9001, name: "Denis Villeneuve", role: "director" }] }).where(eq(catalog.id, duna.catalogId));
    await seed.title(userId, duna.catalogId, { watchedAt: new Date("2026-10-01T12:00:00Z") });
    const premiere = await seed.film({ name: "Duna: Parte tres" });
    duna3 = premiere.catalogId;
    await db.update(catalog).set({ tmdbPeople: [{ id: 9001, name: "Denis Villeneuve", role: "director" }] }).where(eq(catalog.id, duna3));
    await db.insert(cinemaReleases).values({ catalogId: duna3, mxReleaseDate: "2026-12-17", status: "upcoming" });
    await db.insert(pushSubscriptions).values({ id: `${userId}-sub`, userId, endpoint: `https://push.test/${userId}`, p256dh: "k", auth: "a" });
  });

  after(async () => {
    await db.delete(cinemaReleases).where(eq(cinemaReleases.catalogId, duna3));
    await seed.cleanup();
    await closeLocalPg();
  });

  it("shows the premiere with the person of yours behind it, and nothing to someone without one", async () => {
    const now = new Date("2026-10-23T18:00:00Z");
    const [hero] = await loadCountdowns(userId, now);
    assert.equal(hero?.release.name, "Duna: Parte tres");
    assert.equal(hero?.days, 55);
    assert.equal(hero?.reason, "Denis Villeneuve, que dirigió Duna");
    assert.equal(hero?.reminded, false);
    assert.deepEqual(await loadCountdowns(stranger, now), []);
  });

  it("«Avísame el día» is pushed once, on the premiere day (forced date)", async () => {
    const before = new Date("2026-10-23T18:00:00Z");
    const outcome = await remindPremiere(userId, duna3, before);
    assert.deepEqual(outcome, { ok: true, mxReleaseDate: "2026-12-17", pushReady: true });
    assert.equal((await loadCountdowns(userId, before))[0]?.reminded, true);

    const sent: string[] = [];
    const sender = async (_subscription: unknown, payload: { body: string }) => {
      sent.push(payload.body);
      return "sent" as const;
    };
    const dayBefore = await notifyPremiereReminders(new Date("2026-12-16T18:00:00Z"), sender, { requirePushConfig: false });
    assert.equal(dayBefore.due, 0);
    const premiereDay = new Date("2026-12-17T15:00:00Z");
    const first = await notifyPremiereReminders(premiereDay, sender, { requirePushConfig: false });
    assert.equal(first.sent, 1);
    assert.equal(sent[0], "«Duna: Parte tres». Denis Villeneuve, que dirigió Duna.");
    const again = await notifyPremiereReminders(premiereDay, sender, { requirePushConfig: false });
    assert.equal(again.due, 0, "never twice");
    const ledger = await db.query.pickEvents.findMany({ where: eq(pickEvents.userId, userId) });
    assert.ok(ledger.some((event) => event.kind === "cine_avisado" && event.lens === "cine:2026-12-17"));
  });
});
