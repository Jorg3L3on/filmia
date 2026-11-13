import { describeWithDb } from "@/lib/test-support/local-db";
import assert from "node:assert/strict";
import { after, before, it } from "node:test";
import { eq } from "drizzle-orm";
import { db, oscarCeremonies, oscarVotes, oscarWinners } from "@/db";
import { closeLocalPg } from "@/db/local-pg";
import { seeder } from "@/lib/test-support/seed";
import {
  castOscarVote,
  getOscarSeason,
  getOscarVotes,
  getOscarWinners,
  setOscarClosesAt,
  setOscarWinner,
  winnerIds,
} from "@/lib/quinielas/store";
import { scoreOscarBallot } from "@/lib/quinielas/ceremony-core";
import { getOscarCeremony, registerOscarCeremonyForTests } from "@/lib/quinielas/ceremonies";

// The 2024 ceremony under a year of its own: suites run in parallel and never share rows.
const YEAR = 2124;
registerOscarCeremonyForTests(YEAR);
const seed = seeder("quiniela");
const closesAt = new Date("2124-03-10T23:00:00Z");
const before_ = new Date("2124-03-01T12:00:00Z");
const after_ = new Date("2124-03-10T23:00:00Z");

describeWithDb("Quiniela del Óscar on a local database (FIL-I51-1)", () => {
  let ana = "";
  let luis = "";

  before(async () => {
    ana = await seed.user("Ana");
    luis = await seed.user("Luis");
    await db.delete(oscarWinners).where(eq(oscarWinners.year, YEAR));
    await setOscarClosesAt(YEAR, closesAt);
  });

  after(async () => {
    await db.delete(oscarWinners).where(eq(oscarWinners.year, YEAR));
    await db.delete(oscarCeremonies).where(eq(oscarCeremonies.year, YEAR));
    await seed.cleanup();
    await closeLocalPg();
  });

  it("the season reads open before the close and closed after", async () => {
    assert.equal((await getOscarSeason(YEAR, before_)).phase, "abierta");
    assert.equal((await getOscarSeason(YEAR, after_)).phase, "cerrada");
    assert.equal((await getOscarSeason(1999, before_)).phase, "pronto");
  });

  it("votes, changes the vote, and keeps one row per category", async () => {
    assert.deepEqual(
      await castOscarVote({ userId: ana, year: YEAR, categoryId: "actriz", nomineeId: "nm4291409", now: before_ }),
      { ok: true, nomineeId: "nm4291409" },
    );
    assert.deepEqual(
      await castOscarVote({ userId: ana, year: YEAR, categoryId: "actriz", nomineeId: "nm1297015", now: before_ }),
      { ok: true, nomineeId: "nm1297015" },
    );
    await castOscarVote({ userId: ana, year: YEAR, categoryId: "pelicula", nomineeId: "tt15398776", now: before_ });
    assert.deepEqual(await getOscarVotes(ana, YEAR), { actriz: "nm1297015", pelicula: "tt15398776" });
    const rows = await db.select().from(oscarVotes).where(eq(oscarVotes.userId, ana));
    assert.equal(rows.length, 2);
  });

  it("refuses a nominee that is not in the category", async () => {
    assert.deepEqual(
      await castOscarVote({ userId: ana, year: YEAR, categoryId: "actriz", nomineeId: "tt15398776", now: before_ }),
      { ok: false, reason: "invalida" },
    );
    assert.deepEqual(
      await castOscarVote({ userId: ana, year: 1999, categoryId: "actriz", nomineeId: "nm1297015", now: before_ }),
      { ok: false, reason: "invalida" },
    );
  });

  it("after the close the server refuses new votes and changes", async () => {
    assert.deepEqual(
      await castOscarVote({ userId: ana, year: YEAR, categoryId: "actriz", nomineeId: "nm4291409", now: after_ }),
      { ok: false, reason: "cerrada" },
    );
    assert.deepEqual(
      await castOscarVote({ userId: luis, year: YEAR, categoryId: "actor", nomineeId: "nm0614165", now: after_ }),
      { ok: false, reason: "cerrada" },
    );
    assert.deepEqual(await getOscarVotes(ana, YEAR), { actriz: "nm1297015", pelicula: "tt15398776" });
    assert.deepEqual(await getOscarVotes(luis, YEAR), {});
  });

  it("a ceremony without a closing time takes no votes", async () => {
    await db.delete(oscarCeremonies).where(eq(oscarCeremonies.year, YEAR));
    assert.deepEqual(
      await castOscarVote({ userId: luis, year: YEAR, categoryId: "actor", nomineeId: "nm0614165", now: before_ }),
      { ok: false, reason: "cerrada" },
    );
    await setOscarClosesAt(YEAR, closesAt);
  });

  it("winners entered and corrected recalculate the score", async () => {
    const ids = getOscarCeremony(YEAR)!.categories.map((category) => category.id);
    await setOscarWinner({ year: YEAR, categoryId: "actriz", nomineeId: "nm4291409", enteredByUserId: luis });
    let score = scoreOscarBallot(ids, await getOscarVotes(ana, YEAR), winnerIds(await getOscarWinners(YEAR)));
    assert.deepEqual([score.hits, score.announced], [0, 1]);

    const firstAnnounced = (await getOscarWinners(YEAR)).actriz!.announcedAt;
    await setOscarWinner({ year: YEAR, categoryId: "actriz", nomineeId: "nm1297015", enteredByUserId: luis });
    const winners = await getOscarWinners(YEAR);
    assert.equal(winners.actriz?.announcedAt.getTime(), firstAnnounced.getTime());
    score = scoreOscarBallot(ids, await getOscarVotes(ana, YEAR), winnerIds(winners));
    assert.deepEqual([score.hits, score.announced], [1, 1]);

    await assert.rejects(
      setOscarWinner({ year: YEAR, categoryId: "actriz", nomineeId: "nada", enteredByUserId: luis }),
      /no está en la entrega/,
    );
  });
});
