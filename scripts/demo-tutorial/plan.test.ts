import { describeWithDb } from "@/lib/test-support/local-db";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createId } from "@paralleldrive/cuid2";
import { and, eq, inArray } from "drizzle-orm";
import { catalog, db, listInvites, listJoinRequests, listMembers, lists, pushSubscriptions, titles, users } from "@/db";
import { closeLocalPg } from "@/db/local-pg";
import { seeder } from "@/lib/test-support/seed";
import { WATCHED_2026 } from "./data";
import {
  applyPlan,
  assertPlanScope,
  buildPlan,
  checkCounts,
  readCounts,
  readState,
  topPicks,
  type Op,
  type PlanConfig,
  type TutorialCounts,
} from "./plan";

const READY: TutorialCounts = {
  watchedInOctober: 34,
  quieroVer: 31,
  watchedRated2026: 12,
  yearTopItems: 10,
  platforms: 6,
  sharedMembers: 4,
  sharedMembersInvalid: 4,
  friendSideRows: 0,
};

const config: PlanConfig = {
  demoUserId: "demo",
  demoEmail: "demo@filmia.local",
  friends: [{ id: "amigo-1", email: "uno@filmia.invalid", name: "Uno", role: "EDITOR" }],
};

describe("Demo tutorial · guards (FIL-I38-2)", () => {
  it("refuses a write for any user outside the demo and its friends", () => {
    const foreign: Op[] = [
      { op: "updateTitle", userId: "otra-persona", label: "x", titleId: "t1", set: { rating: 10 } },
      { op: "setPlatforms", userId: "otra-persona", platforms: ["NETFLIX"] },
      { op: "insertItem", listOwnerId: "otra-persona", listId: "l", listName: "l", label: "x", catalogId: "c", addedByUserId: "demo", position: 0, queueNote: null },
      { op: "insertItem", listOwnerId: "demo", listId: "l", listName: "l", label: "x", catalogId: "c", addedByUserId: "otra-persona", position: 0, queueNote: null },
      { op: "insertMember", listOwnerId: "demo", listId: "l", userId: "otra-persona", role: "EDITOR" },
      { op: "deleteItem", listOwnerId: "otra-persona", listId: "l", listName: "l", label: "x", catalogId: "c" },
      { op: "insertUser", userId: "otra-persona", email: "otra@filmia.invalid", name: "Otra" },
    ];
    for (const op of foreign) {
      assert.throws(() => assertPlanScope([op], config), /Guarda FIL-I38/, op.op);
    }
  });

  it("refuses a fictitious account outside .invalid", () => {
    assert.throws(
      () => assertPlanScope([{ op: "insertUser", userId: "amigo-1", email: "uno@gmail.com", name: "Uno" }], config),
      /no termina en \.invalid/,
    );
    assert.throws(
      () => assertPlanScope([], { ...config, friends: [{ ...config.friends[0], email: "uno@filmia.local" }] }),
      /no termina en \.invalid/,
    );
  });

  it("lets the demo, its friends and new catalog rows through", () => {
    assert.doesNotThrow(() =>
      assertPlanScope(
        [
          { op: "setPlatforms", userId: "demo", platforms: ["NETFLIX"] },
          { op: "insertUser", userId: "amigo-1", email: "uno@filmia.invalid", name: "Uno" },
          { op: "insertItem", listOwnerId: "demo", listId: "l", listName: "l", label: "x", catalogId: "c", addedByUserId: "amigo-1", position: 0, queueNote: null },
          { op: "insertMember", listOwnerId: "demo", listId: "l", userId: "amigo-1", role: "VIEWER" },
        ],
        config,
      ),
    );
  });

  it("the count check fails below 10 watched and rated 2026 films", () => {
    assert.deepEqual(checkCounts(READY), []);
    const failures = checkCounts({ ...READY, watchedRated2026: 9 });
    assert.equal(failures.length, 1);
    assert.match(failures[0], /2026 vistas y calificadas: 9/);
    assert.equal(checkCounts({ ...READY, quieroVer: 29, watchedInOctober: 12, friendSideRows: 1 }).length, 3);
  });

  it("the data has ten 2026 films for the top, in rating order", () => {
    assert.ok(WATCHED_2026.length >= 10);
    assert.ok(WATCHED_2026.every((film) => film.kind === "MOVIE" && film.year === 2026 && film.rating >= 1 && film.rating <= 10));
    const picks = topPicks();
    assert.equal(picks.length, 10);
    assert.deepEqual(picks.map((film) => film.rating), [...picks.map((film) => film.rating)].sort((a, b) => b - a));
  });
});

const seed = seeder("tutorial");

describeWithDb("Demo tutorial · local DB (FIL-I38-1/2)", () => {
  let local: PlanConfig;
  let bystander = "";
  const createdCatalog: string[] = [];

  before(async () => {
    const demoId = await seed.user("Demo");
    bystander = await seed.user("Otra");
    const tag = createId().slice(0, 6);
    local = {
      demoUserId: demoId,
      demoEmail: `${demoId}@filmia.test`,
      friends: ["Lalo", "Pau", "Memo", "Tere"].map((name, index) => ({
        id: `tutorial-${name.toLowerCase()}-${tag}`,
        email: `${name.toLowerCase()}-${tag}@filmia.invalid`,
        name,
        role: index === 3 ? "VIEWER" : "EDITOR",
      })),
    };
  });

  after(async () => {
    await db.delete(users).where(inArray(users.id, local.friends.map((friend) => friend.id)));
    await seed.cleanup();
    if (createdCatalog.length) await db.delete(catalog).where(inArray(catalog.id, createdCatalog));
    await closeLocalPg();
  });

  it("dry-run plans writes but writes nothing", async () => {
    const before = await readCounts(local);
    const plan = buildPlan(await readState(local), local);
    assert.ok(plan.ops.length > 60, `ops: ${plan.ops.length}`);
    assertPlanScope(plan.ops, local);
    assert.deepEqual(await readCounts(local), before);
    assert.equal(before.watchedInOctober, 0);
  });

  it("apply fills every shot, only for the demo and fictitious friends", async () => {
    const otherTitlesBefore = await db.select({ id: titles.id }).from(titles).where(eq(titles.userId, bystander));
    const plan = buildPlan(await readState(local), local);
    for (const op of plan.ops) if (op.op === "insertCatalog") createdCatalog.push(op.film.id);
    await applyPlan(plan.ops, local);

    const counts = await readCounts(local);
    assert.deepEqual(checkCounts(counts), [], JSON.stringify(counts));
    assert.ok(counts.watchedInOctober >= 30);
    assert.ok(counts.quieroVer >= 30);
    assert.ok(counts.watchedRated2026 >= 10);
    assert.equal(counts.yearTopItems, 10);
    assert.equal(counts.sharedMembers, 4);

    const friendIds = local.friends.map((friend) => friend.id);
    const [invites, requests, pushes] = await Promise.all([
      db.select().from(listInvites).where(inArray(listInvites.createdByUserId, friendIds)),
      db.select().from(listJoinRequests).where(inArray(listJoinRequests.userId, friendIds)),
      db.select().from(pushSubscriptions).where(inArray(pushSubscriptions.userId, friendIds)),
    ]);
    assert.deepEqual([invites.length, requests.length, pushes.length], [0, 0, 0]);
    const friends = await db.select().from(users).where(inArray(users.id, friendIds));
    assert.ok(friends.every((friend) => friend.email.endsWith(".invalid") && friend.passwordHash && !friend.googleId));
    // The shared list is the demo's; friends are members, not owners.
    const shared = await db.select().from(lists).where(and(eq(lists.userId, local.demoUserId), eq(lists.name, "Cine con los cuates")));
    assert.equal(shared.length, 1);
    assert.equal((await db.select().from(listMembers).where(eq(listMembers.listId, shared[0].id))).length, 4);
    assert.equal((await db.select().from(lists).where(inArray(lists.userId, friendIds))).length, 0);

    const otherTitlesAfter = await db.select({ id: titles.id }).from(titles).where(eq(titles.userId, bystander));
    assert.deepEqual(otherTitlesAfter, otherTitlesBefore);
  });

  it("a second run plans 0 writes", async () => {
    const plan = buildPlan(await readState(local), local);
    assert.deepEqual(plan.ops, []);
  });
});
