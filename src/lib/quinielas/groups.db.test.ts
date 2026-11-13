import { describeWithDb } from "@/lib/test-support/local-db";
import assert from "node:assert/strict";
import { after, before, it } from "node:test";
import { eq } from "drizzle-orm";
import { db, quinielaCeremonies, quinielaGroups, quinielaWinners } from "@/db";
import { closeLocalPg } from "@/db/local-pg";
import { seeder } from "@/lib/test-support/seed";
import { registerCeremonyForTests } from "@/lib/quinielas/ceremonies";
import {
  cleanGroupName,
  createGroup,
  deleteGroup,
  getGroupByToken,
  getGroupForMember,
  groupStandings,
  groupToken,
  joinGroup,
  leaveGroup,
  listMyGroups,
  ownerGroupLink,
  regenerateGroupLink,
} from "@/lib/quinielas/groups";
import { castVote, setClosesAt, setWinner } from "@/lib/quinielas/store";

process.env.AUTH_SECRET ||= "test-only-quiniela-groups-secret";

// The 2024 Oscars under ids of their own: suites run in parallel and never share rows.
const CEREMONY = "oscar-2125";
const OTHER = "globos-2125";
registerCeremonyForTests(CEREMONY);
registerCeremonyForTests(OTHER);
const seed = seeder("qgrupo");
const open = new Date("2125-03-01T12:00:00Z");

describeWithDb("Quiniela groups on a local database (FIL-I51-3, one per ceremony)", () => {
  let ana = "";
  let luis = "";
  let eva = "";
  let groupId = "";
  let token = "";

  before(async () => {
    ana = await seed.user("Ana");
    luis = await seed.user("Luis");
    eva = await seed.user("Eva");
    await setClosesAt(CEREMONY, new Date("2125-03-10T23:00:00Z"));
  });

  after(async () => {
    for (const id of [CEREMONY, OTHER]) {
      await db.delete(quinielaWinners).where(eq(quinielaWinners.ceremonyId, id));
      await db.delete(quinielaCeremonies).where(eq(quinielaCeremonies.ceremonyId, id));
    }
    await seed.cleanup();
    await closeLocalPg();
  });

  it("creates a group with a default name, the owner inside and a link that opens it", async () => {
    ({ id: groupId, token } = await createGroup({ ownerId: ana, ceremonyId: CEREMONY, name: "   " }));
    assert.equal(token, groupToken(groupId, 1));
    const byLink = await getGroupByToken(token);
    assert.equal(byLink?.id, groupId);
    assert.equal(byLink?.ceremonyId, CEREMONY);
    assert.equal(byLink?.name, "La quiniela de Ana");
    assert.ok(await getGroupForMember(groupId, ana));
    assert.equal(await ownerGroupLink(groupId, ana), `/extras/quinielas/unirse/${token}`);
    assert.equal(await ownerGroupLink(groupId, luis), null);
    await assert.rejects(createGroup({ ownerId: ana, ceremonyId: "oscar-1999" }), /no tiene quiniela/);
  });

  it("a group belongs to one ceremony: it does not show for another", async () => {
    assert.deepEqual((await listMyGroups(ana, CEREMONY)).map((group) => group.id), [groupId]);
    assert.deepEqual(await listMyGroups(ana, OTHER), []);
  });

  it("a second account joins with the link and both are in the table", async () => {
    assert.deepEqual(await joinGroup(token, luis), { ok: true, groupId });
    assert.deepEqual(await joinGroup(token, luis), { ok: true, groupId });
    await castVote({ userId: ana, ceremonyId: CEREMONY, categoryId: "actriz", nomineeId: "nm1297015", now: open });
    await castVote({ userId: luis, ceremonyId: CEREMONY, categoryId: "actriz", nomineeId: "nm4291409", now: open });
    await castVote({ userId: luis, ceremonyId: CEREMONY, categoryId: "actor", nomineeId: "nm0614165", now: open });
    let table = await groupStandings((await getGroupForMember(groupId, luis))!, luis);
    assert.deepEqual(table.map((row) => [row.name, row.isYou, row.voted, row.hits]), [
      ["Luis", true, 2, 0],
      ["Ana", false, 1, 0],
    ]);
    await setWinner({ ceremonyId: CEREMONY, categoryId: "actriz", nomineeId: "nm1297015", enteredByUserId: ana });
    table = await groupStandings((await getGroupForMember(groupId, luis))!, luis);
    assert.deepEqual(table.map((row) => [row.name, row.hits]), [["Ana", 1], ["Luis", 0]]);
  });

  it("the table carries no email and no picks", async () => {
    const table = await groupStandings((await getGroupForMember(groupId, ana))!, ana);
    const json = JSON.stringify(table);
    assert.ok(!json.includes("@"), json);
    assert.ok(!json.includes("nm1297015"), json);
    assert.deepEqual(Object.keys(table[0]!).sort(), ["hits", "isOwner", "isYou", "name", "voted"]);
  });

  it("someone outside the group cannot read it", async () => {
    assert.equal(await getGroupForMember(groupId, eva), null);
    assert.equal(await getGroupForMember("no-existe", eva), null);
  });

  it("a malformed, unknown or regenerated link opens nothing", async () => {
    assert.equal(await getGroupByToken("corto"), null);
    assert.equal(await getGroupByToken("A".repeat(32)), null);
    assert.equal(await regenerateGroupLink(groupId, luis), null);
    assert.equal(await regenerateGroupLink(groupId, ana), `/extras/quinielas/unirse/${groupToken(groupId, 2)}`);
    assert.equal(await getGroupByToken(token), null);
    assert.deepEqual(await joinGroup(token, eva), { ok: false, reason: "enlace" });
  });

  it("members leave; the owner deletes instead", async () => {
    assert.equal(await leaveGroup(groupId, ana), false);
    assert.equal(await leaveGroup(groupId, luis), true);
    assert.equal(await getGroupForMember(groupId, luis), null);
    assert.equal(await deleteGroup(groupId, luis), null);
    assert.equal(await deleteGroup(groupId, ana), CEREMONY);
    assert.equal((await db.select().from(quinielaGroups).where(eq(quinielaGroups.id, groupId))).length, 0);
  });

  it("cleans the name and falls back to the owner's", () => {
    assert.equal(cleanGroupName("  Los   de la oficina ", "Ana"), "Los de la oficina");
    assert.equal(cleanGroupName(undefined, null), "La quiniela de Alguien");
    assert.equal(cleanGroupName("x".repeat(80), "Ana").length, 40);
  });
});
