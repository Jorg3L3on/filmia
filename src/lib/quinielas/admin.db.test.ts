import { describeWithDb } from "@/lib/test-support/local-db";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { eq } from "drizzle-orm";
import { db, quinielaCeremonies, quinielaWinners, users } from "@/db";
import { closeLocalPg } from "@/db/local-pg";
import { seeder } from "@/lib/test-support/seed";
import { adminClearWinner, adminSetClose, adminSetWinner, mexicoCityLocalToUtc, utcToMexicoCityLocal } from "@/lib/quinielas/admin";
import { getCeremony, registerCeremonyForTests } from "@/lib/quinielas/ceremonies";
import { castVote, getClosesAt, getVotes, getWinners } from "@/lib/quinielas/store";
import { nightSummary, toBallotCategories } from "@/lib/quinielas/view";

describe("quinielas/admin times (FIL-I51-4)", () => {
  it("reads datetime-local as Mexico City time (UTC−6) and back", () => {
    assert.equal(mexicoCityLocalToUtc("2027-03-14T18:00")?.toISOString(), "2027-03-15T00:00:00.000Z");
    assert.equal(utcToMexicoCityLocal(new Date("2027-03-15T00:00:00Z")), "2027-03-14T18:00");
    assert.equal(mexicoCityLocalToUtc("mañana"), null);
  });
});

// The 2024 Oscars under an id of their own: suites run in parallel and never share rows.
const CEREMONY = "oscar-2126";
registerCeremonyForTests(CEREMONY);
const ADMINS = "jorge@quiniela.test";
const seed = seeder("qadmin");

describeWithDb("Quiniela admin on a local database (FIL-I51-4)", () => {
  let admin = { id: "", email: ADMINS };
  let ana = { id: "", email: "" };
  let luis = { id: "", email: "" };

  before(async () => {
    const adminId = await seed.user("Jorge");
    await db.update(users).set({ email: ADMINS }).where(eq(users.id, adminId));
    admin = { id: adminId, email: ADMINS };
    const anaId = await seed.user("Ana");
    const luisId = await seed.user("Luis");
    ana = { id: anaId, email: `${anaId}@filmia.test` };
    luis = { id: luisId, email: `${luisId}@filmia.test` };
  });

  after(async () => {
    await db.delete(quinielaWinners).where(eq(quinielaWinners.ceremonyId, CEREMONY));
    await db.delete(quinielaCeremonies).where(eq(quinielaCeremonies.ceremonyId, CEREMONY));
    await seed.cleanup();
    await closeLocalPg();
  });

  it("only the admin opens the ballots", async () => {
    assert.deepEqual(await adminSetClose(ana, { ceremonyId: CEREMONY, local: "2126-03-14T18:00" }, ADMINS), {
      ok: false,
      error: "Solo el admin puede hacer esto.",
    });
    assert.equal(await getClosesAt(CEREMONY), null);
    assert.deepEqual(await adminSetClose(admin, { ceremonyId: CEREMONY, local: "2126-03-14T18:00" }, ADMINS), { ok: true });
    assert.equal((await getClosesAt(CEREMONY))?.toISOString(), "2126-03-15T00:00:00.000Z");
    assert.deepEqual(await adminSetClose(admin, { ceremonyId: "oscar-1999", local: "2126-03-14T18:00" }, ADMINS), {
      ok: false,
      error: "Revisa la fecha y la entrega.",
    });
  });

  it("two accounts vote; after the close no one can change", async () => {
    const before_ = new Date("2126-03-14T23:59:00Z");
    await castVote({ userId: ana.id, ceremonyId: CEREMONY, categoryId: "actriz", nomineeId: "nm1297015", now: before_ });
    await castVote({ userId: ana.id, ceremonyId: CEREMONY, categoryId: "actor", nomineeId: "nm0614165", now: before_ });
    await castVote({ userId: luis.id, ceremonyId: CEREMONY, categoryId: "actriz", nomineeId: "nm4291409", now: before_ });
    await castVote({ userId: luis.id, ceremonyId: CEREMONY, categoryId: "actor", nomineeId: "nm0614165", now: before_ });
    assert.deepEqual(
      await castVote({ userId: luis.id, ceremonyId: CEREMONY, categoryId: "actriz", nomineeId: "nm1297015", now: new Date("2126-03-15T00:00:00Z") }),
      { ok: false, reason: "cerrada" },
    );
  });

  it("a non-admin cannot enter or correct winners", async () => {
    for (const actor of [ana, null]) {
      assert.deepEqual(await adminSetWinner(actor, { ceremonyId: CEREMONY, categoryId: "actriz", nomineeId: "nm1297015" }, ADMINS), {
        ok: false,
        error: "Solo el admin puede hacer esto.",
      });
    }
    assert.deepEqual(await getWinners(CEREMONY), {});
  });

  it("each account sees its own hits as the admin enters winners, and a correction recalculates all", async () => {
    const categories = toBallotCategories(getCeremony(CEREMONY)!);
    const hitsOf = async (userId: string) => nightSummary(categories, await getVotes(userId, CEREMONY), await getWinners(CEREMONY)).hits;

    await adminSetWinner(admin, { ceremonyId: CEREMONY, categoryId: "actor", nomineeId: "nm0614165" }, ADMINS);
    await adminSetWinner(admin, { ceremonyId: CEREMONY, categoryId: "actriz", nomineeId: "nm4291409" }, ADMINS);
    assert.deepEqual([await hitsOf(ana.id), await hitsOf(luis.id)], [1, 2]);

    assert.deepEqual(await adminSetWinner(admin, { ceremonyId: CEREMONY, categoryId: "actriz", nomineeId: "nm1297015" }, ADMINS), { ok: true });
    assert.deepEqual([await hitsOf(ana.id), await hitsOf(luis.id)], [2, 1]);

    assert.deepEqual(await adminClearWinner(ana, { ceremonyId: CEREMONY, categoryId: "actor" }, ADMINS), {
      ok: false,
      error: "Solo el admin puede hacer esto.",
    });
    assert.deepEqual(await adminClearWinner(admin, { ceremonyId: CEREMONY, categoryId: "actor" }, ADMINS), { ok: true });
    assert.deepEqual([await hitsOf(ana.id), await hitsOf(luis.id)], [1, 0]);
    assert.deepEqual(await adminSetWinner(admin, { ceremonyId: CEREMONY, categoryId: "actriz", nomineeId: "no-existe" }, ADMINS), {
      ok: false,
      error: "Esa nominada no está en la entrega.",
    });
  });
});
