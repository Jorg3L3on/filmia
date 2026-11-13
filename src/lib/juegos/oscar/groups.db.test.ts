import { describeWithDb } from "@/lib/test-support/local-db";
import assert from "node:assert/strict";
import { after, before, it } from "node:test";
import { eq } from "drizzle-orm";
import { db, oscarCeremonies, oscarGroups, oscarWinners } from "@/db";
import { closeLocalPg } from "@/db/local-pg";
import { seeder } from "@/lib/test-support/seed";
import {
  cleanGroupName,
  createOscarGroup,
  deleteOscarGroup,
  getOscarGroupByToken,
  getOscarGroupForMember,
  joinOscarGroup,
  leaveOscarGroup,
  listMyOscarGroups,
  oscarGroupStandings,
  oscarGroupToken,
  ownerOscarGroupLink,
  regenerateOscarGroupLink,
} from "@/lib/juegos/oscar/groups";
import { castOscarVote, setOscarClosesAt, setOscarWinner } from "@/lib/juegos/oscar/store";
import { registerOscarCeremonyForTests } from "@/lib/juegos/oscar/ceremonies";

process.env.AUTH_SECRET ||= "test-only-quiniela-groups-secret";

// The 2024 ceremony under a year of its own: suites run in parallel and never share rows.
const YEAR = 2125;
registerOscarCeremonyForTests(YEAR);
const seed = seeder("qgrupo");
const open = new Date("2124-03-01T12:00:00Z");

describeWithDb("Quiniela groups on a local database (FIL-I51-3)", () => {
  let ana = "";
  let luis = "";
  let eva = "";
  let groupId = "";
  let token = "";

  before(async () => {
    ana = await seed.user("Ana");
    luis = await seed.user("Luis");
    eva = await seed.user("Eva");
    await setOscarClosesAt(YEAR, new Date("2124-03-10T23:00:00Z"));
  });

  after(async () => {
    await db.delete(oscarWinners).where(eq(oscarWinners.year, YEAR));
    await db.delete(oscarCeremonies).where(eq(oscarCeremonies.year, YEAR));
    await seed.cleanup();
    await closeLocalPg();
  });

  it("creates a group with a default name, the owner inside and a link that opens it", async () => {
    ({ id: groupId, token } = await createOscarGroup({ ownerId: ana, year: YEAR, name: "   " }));
    assert.equal(token, oscarGroupToken(groupId, 1));
    const byLink = await getOscarGroupByToken(token);
    assert.equal(byLink?.id, groupId);
    assert.equal(byLink?.name, "La quiniela de Ana");
    assert.equal(byLink?.ownerName, "Ana");
    assert.ok(await getOscarGroupForMember(groupId, ana));
    assert.equal(await ownerOscarGroupLink(groupId, ana), `/juegos/oscar/unirse/${token}`);
    assert.equal(await ownerOscarGroupLink(groupId, luis), null);
  });

  it("a second account joins with the link and both are in the table", async () => {
    assert.deepEqual(await joinOscarGroup(token, luis), { ok: true, groupId });
    assert.deepEqual(await joinOscarGroup(token, luis), { ok: true, groupId });
    await castOscarVote({ userId: ana, year: YEAR, categoryId: "actriz", nomineeId: "nm1297015", now: open });
    await castOscarVote({ userId: luis, year: YEAR, categoryId: "actriz", nomineeId: "nm4291409", now: open });
    await castOscarVote({ userId: luis, year: YEAR, categoryId: "actor", nomineeId: "nm0614165", now: open });
    let table = await oscarGroupStandings((await getOscarGroupForMember(groupId, luis))!, luis);
    assert.deepEqual(
      table.map((row) => [row.name, row.isYou, row.voted, row.hits]),
      [
        ["Luis", true, 2, 0],
        ["Ana", false, 1, 0],
      ],
    );
    await setOscarWinner({ year: YEAR, categoryId: "actriz", nomineeId: "nm1297015", enteredByUserId: ana });
    table = await oscarGroupStandings((await getOscarGroupForMember(groupId, luis))!, luis);
    assert.deepEqual(table.map((row) => [row.name, row.hits]), [["Ana", 1], ["Luis", 0]]);
    assert.deepEqual((await listMyOscarGroups(luis, YEAR)).map((group) => group.id), [groupId]);
  });

  it("the table carries no email and no picks", async () => {
    const table = await oscarGroupStandings((await getOscarGroupForMember(groupId, ana))!, ana);
    const json = JSON.stringify(table);
    assert.ok(!json.includes("@"), json);
    assert.ok(!json.includes("nm1297015"), json);
    assert.deepEqual(Object.keys(table[0]!).sort(), ["hits", "isOwner", "isYou", "name", "voted"]);
  });

  it("someone outside the group cannot read it", async () => {
    assert.equal(await getOscarGroupForMember(groupId, eva), null);
    assert.equal(await getOscarGroupForMember("no-existe", eva), null);
  });

  it("a malformed, unknown or regenerated link opens nothing", async () => {
    assert.equal(await getOscarGroupByToken("corto"), null);
    assert.equal(await getOscarGroupByToken("A".repeat(32)), null);
    assert.equal(await regenerateOscarGroupLink(groupId, luis), null);
    const fresh = await regenerateOscarGroupLink(groupId, ana);
    assert.equal(fresh, `/juegos/oscar/unirse/${oscarGroupToken(groupId, 2)}`);
    assert.equal(await getOscarGroupByToken(token), null);
    assert.deepEqual(await joinOscarGroup(token, eva), { ok: false, reason: "enlace" });
    assert.equal(await getOscarGroupForMember(groupId, eva), null);
  });

  it("members leave; the owner deletes instead", async () => {
    assert.equal(await leaveOscarGroup(groupId, ana), false);
    assert.equal(await leaveOscarGroup(groupId, luis), true);
    assert.equal(await getOscarGroupForMember(groupId, luis), null);
    assert.equal(await deleteOscarGroup(groupId, luis), false);
    assert.equal(await deleteOscarGroup(groupId, ana), true);
    assert.equal((await db.select().from(oscarGroups).where(eq(oscarGroups.id, groupId))).length, 0);
  });

  it("cleans the name and falls back to the owner's", () => {
    assert.equal(cleanGroupName("  Los   de la oficina ", "Ana"), "Los de la oficina");
    assert.equal(cleanGroupName(undefined, null), "La quiniela de Alguien");
    assert.equal(cleanGroupName("x".repeat(80), "Ana").length, 40);
  });
});
