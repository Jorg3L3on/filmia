import { describeWithDb } from "@/lib/test-support/local-db";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { eq } from "drizzle-orm";
import { db, oscarCeremonies, oscarWinners, users } from "@/db";
import { closeLocalPg } from "@/db/local-pg";
import { seeder } from "@/lib/test-support/seed";
import {
  adminClearOscarWinner,
  adminSetOscarClose,
  adminSetOscarWinner,
  mexicoCityLocalToUtc,
  utcToMexicoCityLocal,
} from "@/lib/quinielas/admin";
import { registerOscarCeremonyForTests } from "@/lib/quinielas/ceremonies";
import { castOscarVote, getOscarClosesAt, getOscarVotes, getOscarWinners } from "@/lib/quinielas/store";
import { oscarNightSummary, toBallotCategories } from "@/lib/quinielas/view";
import { getOscarCeremony } from "@/lib/quinielas/ceremonies";

describe("quiniela/admin times (FIL-I51-4)", () => {
  it("reads datetime-local as Mexico City time (UTC−6) and back", () => {
    assert.equal(mexicoCityLocalToUtc("2027-03-14T18:00")?.toISOString(), "2027-03-15T00:00:00.000Z");
    assert.equal(utcToMexicoCityLocal(new Date("2027-03-15T00:00:00Z")), "2027-03-14T18:00");
    assert.equal(mexicoCityLocalToUtc("mañana"), null);
  });
});

// The 2024 ceremony under a year of its own: suites run in parallel and never share rows.
const YEAR = 2126;
registerOscarCeremonyForTests(YEAR);
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
    await db.delete(oscarWinners).where(eq(oscarWinners.year, YEAR));
    await db.delete(oscarCeremonies).where(eq(oscarCeremonies.year, YEAR));
    await seed.cleanup();
    await closeLocalPg();
  });

  it("only the admin opens the ballots", async () => {
    assert.deepEqual(await adminSetOscarClose(ana, { year: YEAR, local: "2126-03-14T18:00" }, ADMINS), {
      ok: false,
      error: "Solo el admin puede hacer esto.",
    });
    assert.equal(await getOscarClosesAt(YEAR), null);
    assert.deepEqual(await adminSetOscarClose(admin, { year: YEAR, local: "2126-03-14T18:00" }, ADMINS), { ok: true });
    assert.equal((await getOscarClosesAt(YEAR))?.toISOString(), "2126-03-15T00:00:00.000Z");
  });

  it("two accounts vote; after the close no one can change", async () => {
    const before_ = new Date("2126-03-14T23:59:00Z");
    await castOscarVote({ userId: ana.id, year: YEAR, categoryId: "actriz", nomineeId: "nm1297015", now: before_ });
    await castOscarVote({ userId: ana.id, year: YEAR, categoryId: "actor", nomineeId: "nm0614165", now: before_ });
    await castOscarVote({ userId: luis.id, year: YEAR, categoryId: "actriz", nomineeId: "nm4291409", now: before_ });
    await castOscarVote({ userId: luis.id, year: YEAR, categoryId: "actor", nomineeId: "nm0614165", now: before_ });
    const atStart = new Date("2126-03-15T00:00:00Z");
    assert.deepEqual(
      await castOscarVote({ userId: luis.id, year: YEAR, categoryId: "actriz", nomineeId: "nm1297015", now: atStart }),
      { ok: false, reason: "cerrada" },
    );
  });

  it("a non-admin cannot enter or correct winners", async () => {
    assert.deepEqual(await adminSetOscarWinner(ana, { year: YEAR, categoryId: "actriz", nomineeId: "nm1297015" }, ADMINS), {
      ok: false,
      error: "Solo el admin puede hacer esto.",
    });
    assert.deepEqual(await adminSetOscarWinner(null, { year: YEAR, categoryId: "actriz", nomineeId: "nm1297015" }, ADMINS), {
      ok: false,
      error: "Solo el admin puede hacer esto.",
    });
    assert.deepEqual(await getOscarWinners(YEAR), {});
  });

  it("each account sees its own hits as the admin enters winners, and a correction recalculates all", async () => {
    const categories = toBallotCategories(getOscarCeremony(YEAR)!);
    const hitsOf = async (userId: string) =>
      oscarNightSummary(categories, await getOscarVotes(userId, YEAR), await getOscarWinners(YEAR)).hits;

    await adminSetOscarWinner(admin, { year: YEAR, categoryId: "actor", nomineeId: "nm0614165" }, ADMINS);
    await adminSetOscarWinner(admin, { year: YEAR, categoryId: "actriz", nomineeId: "nm4291409" }, ADMINS);
    assert.deepEqual([await hitsOf(ana.id), await hitsOf(luis.id)], [1, 2]);

    // Entered by mistake: Emma Stone won.
    assert.deepEqual(await adminSetOscarWinner(admin, { year: YEAR, categoryId: "actriz", nomineeId: "nm1297015" }, ADMINS), { ok: true });
    assert.deepEqual([await hitsOf(ana.id), await hitsOf(luis.id)], [2, 1]);

    assert.deepEqual(await adminClearOscarWinner(ana, { year: YEAR, categoryId: "actor" }, ADMINS), {
      ok: false,
      error: "Solo el admin puede hacer esto.",
    });
    assert.deepEqual(await adminClearOscarWinner(admin, { year: YEAR, categoryId: "actor" }, ADMINS), { ok: true });
    assert.deepEqual([await hitsOf(ana.id), await hitsOf(luis.id)], [1, 0]);
    assert.deepEqual(
      await adminSetOscarWinner(admin, { year: YEAR, categoryId: "actriz", nomineeId: "no-existe" }, ADMINS),
      { ok: false, error: "Esa nominada no está en la entrega." },
    );
  });
});
