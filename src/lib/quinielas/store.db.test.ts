import { describeWithDb } from "@/lib/test-support/local-db";
import assert from "node:assert/strict";
import { after, before, it } from "node:test";
import { eq } from "drizzle-orm";
import { db, quinielaCeremonies, quinielaVotes, quinielaWinners } from "@/db";
import { closeLocalPg } from "@/db/local-pg";
import { seeder } from "@/lib/test-support/seed";
import { getCeremony, registerCeremonyForTests } from "@/lib/quinielas/ceremonies";
import { scoreBallot } from "@/lib/quinielas/ceremony-core";
import {
  castVote,
  getClosingTimes,
  getSeason,
  getVoteCounts,
  getVotes,
  getWinners,
  setClosesAt,
  setWinner,
  winnerIds,
} from "@/lib/quinielas/store";

// The 2024 Oscars under an id of their own: suites run in parallel and never share rows.
const CEREMONY = "oscar-2124";
const OTHER = "bafta-2124";
registerCeremonyForTests(CEREMONY);
registerCeremonyForTests(OTHER);
const seed = seeder("quiniela");
const closesAt = new Date("2124-03-10T23:00:00Z");
const before_ = new Date("2124-03-01T12:00:00Z");
const after_ = new Date("2124-03-10T23:00:00Z");

describeWithDb("Quinielas on a local database (FIL-I51-1, by ceremony in FIL-I51-7)", () => {
  let ana = "";
  let luis = "";

  before(async () => {
    ana = await seed.user("Ana");
    luis = await seed.user("Luis");
    await setClosesAt(CEREMONY, closesAt);
    await setClosesAt(OTHER, closesAt);
  });

  after(async () => {
    for (const id of [CEREMONY, OTHER]) {
      await db.delete(quinielaWinners).where(eq(quinielaWinners.ceremonyId, id));
      await db.delete(quinielaCeremonies).where(eq(quinielaCeremonies.ceremonyId, id));
    }
    await seed.cleanup();
    await closeLocalPg();
  });

  it("the season reads open before the close and closed after", async () => {
    assert.equal((await getSeason(CEREMONY, before_)).phase, "abierta");
    assert.equal((await getSeason(CEREMONY, after_)).phase, "cerrada");
    assert.equal((await getSeason("oscar-1999", before_)).phase, "pronto");
  });

  it("votes, changes the vote, and keeps one row per category", async () => {
    assert.deepEqual(
      await castVote({ userId: ana, ceremonyId: CEREMONY, categoryId: "actriz", nomineeId: "nm4291409", now: before_ }),
      { ok: true, nomineeId: "nm4291409" },
    );
    assert.deepEqual(
      await castVote({ userId: ana, ceremonyId: CEREMONY, categoryId: "actriz", nomineeId: "nm1297015", now: before_ }),
      { ok: true, nomineeId: "nm1297015" },
    );
    await castVote({ userId: ana, ceremonyId: CEREMONY, categoryId: "pelicula", nomineeId: "tt15398776", now: before_ });
    assert.deepEqual(await getVotes(ana, CEREMONY), { actriz: "nm1297015", pelicula: "tt15398776" });
    assert.equal((await db.select().from(quinielaVotes).where(eq(quinielaVotes.userId, ana))).length, 2);
  });

  it("the same category in another ceremony is a separate vote", async () => {
    await castVote({ userId: ana, ceremonyId: OTHER, categoryId: "actriz", nomineeId: "nm4291409", now: before_ });
    assert.deepEqual(await getVotes(ana, OTHER), { actriz: "nm4291409" });
    assert.deepEqual(await getVotes(ana, CEREMONY), { actriz: "nm1297015", pelicula: "tt15398776" });
    assert.deepEqual(await getVoteCounts(ana), { [CEREMONY]: 2, [OTHER]: 1 });
    const closing = await getClosingTimes();
    assert.equal(closing[CEREMONY]?.getTime(), closesAt.getTime());
  });

  it("refuses a nominee that is not in the category, and an unknown ceremony", async () => {
    assert.deepEqual(
      await castVote({ userId: ana, ceremonyId: CEREMONY, categoryId: "actriz", nomineeId: "tt15398776", now: before_ }),
      { ok: false, reason: "invalida" },
    );
    assert.deepEqual(
      await castVote({ userId: ana, ceremonyId: "oscar-1999", categoryId: "actriz", nomineeId: "nm1297015", now: before_ }),
      { ok: false, reason: "invalida" },
    );
  });

  it("after the close the server refuses new votes and changes", async () => {
    assert.deepEqual(
      await castVote({ userId: ana, ceremonyId: CEREMONY, categoryId: "actriz", nomineeId: "nm4291409", now: after_ }),
      { ok: false, reason: "cerrada" },
    );
    assert.deepEqual(
      await castVote({ userId: luis, ceremonyId: CEREMONY, categoryId: "actor", nomineeId: "nm0614165", now: after_ }),
      { ok: false, reason: "cerrada" },
    );
    assert.deepEqual(await getVotes(ana, CEREMONY), { actriz: "nm1297015", pelicula: "tt15398776" });
    assert.deepEqual(await getVotes(luis, CEREMONY), {});
  });

  it("a ceremony without a closing time takes no votes", async () => {
    await db.delete(quinielaCeremonies).where(eq(quinielaCeremonies.ceremonyId, CEREMONY));
    assert.deepEqual(
      await castVote({ userId: luis, ceremonyId: CEREMONY, categoryId: "actor", nomineeId: "nm0614165", now: before_ }),
      { ok: false, reason: "cerrada" },
    );
    await setClosesAt(CEREMONY, closesAt);
  });

  it("winners entered and corrected recalculate the score", async () => {
    const ids = getCeremony(CEREMONY)!.categories.map((category) => category.id);
    await setWinner({ ceremonyId: CEREMONY, categoryId: "actriz", nomineeId: "nm4291409", enteredByUserId: luis });
    let score = scoreBallot(ids, await getVotes(ana, CEREMONY), winnerIds(await getWinners(CEREMONY)));
    assert.deepEqual([score.hits, score.announced], [0, 1]);
    const firstAnnounced = (await getWinners(CEREMONY)).actriz!.announcedAt;
    await setWinner({ ceremonyId: CEREMONY, categoryId: "actriz", nomineeId: "nm1297015", enteredByUserId: luis });
    const winners = await getWinners(CEREMONY);
    assert.equal(winners.actriz?.announcedAt.getTime(), firstAnnounced.getTime());
    score = scoreBallot(ids, await getVotes(ana, CEREMONY), winnerIds(winners));
    assert.deepEqual([score.hits, score.announced], [1, 1]);
    assert.deepEqual(await getWinners(OTHER), {});
    await assert.rejects(
      setWinner({ ceremonyId: CEREMONY, categoryId: "actriz", nomineeId: "nada", enteredByUserId: luis }),
      /no está en la entrega/,
    );
  });
});
