import "@/lib/test-support/node-async-local-storage";

import assert from "node:assert/strict";
import { after, before, it } from "node:test";
import { and, eq } from "drizzle-orm";
import { createListWithFeedback, updateListWithFeedback } from "@/app/actions/lists";
import { markNotTonight } from "@/app/actions/tonight";
import { updateWatchlistNote } from "@/app/actions/watchlist";
import { db, listItems, lists, pickEvents } from "@/db";
import { closeLocalPg } from "@/db/local-pg";
import { WATCHLIST_SLUG } from "@/lib/lists";
import { describeWithDb } from "@/lib/test-support/local-db";
import { runAsUser } from "@/lib/test-support/run-as-user";
import { seeder } from "@/lib/test-support/seed";
import { LIST_DESCRIPTION_MAX, LIST_NAME_MAX, PICK_LENS_MAX, QUEUE_NOTE_MAX } from "@/lib/text-limits";

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};

describeWithDb("free text has a server-side cap (FIL-I41-9)", () => {
  const seed = seeder("t-text-cap");
  let userId = "";

  before(async () => {
    userId = await seed.user("Lía");
  });

  after(async () => {
    await seed.cleanup();
    await closeLocalPg();
  });

  const ownLists = () => db.query.lists.findMany({ where: and(eq(lists.userId, userId), eq(lists.kind, "COLLECTION")) });

  it("refuses an over-long list name or description and writes nothing", async () => {
    const before = (await ownLists()).length;
    const longName = await runAsUser(userId, () =>
      createListWithFeedback(null, form({ name: "A".repeat(LIST_NAME_MAX + 1), description: "" })),
    );
    assert.match(longName?.error ?? "", /demasiado largo/);
    const longDescription = await runAsUser(userId, () =>
      createListWithFeedback(null, form({ name: "Corta", description: "D".repeat(LIST_DESCRIPTION_MAX + 1) })),
    );
    assert.match(longDescription?.error ?? "", /demasiado larga/);
    assert.equal((await ownLists()).length, before);
  });

  it("refuses an over-long description when editing a list and keeps the old one", async () => {
    const listId = await seed.collection(userId, "Domingo");
    await db.update(lists).set({ description: "Antes" }).where(eq(lists.id, listId));
    const outcome = await runAsUser(userId, () =>
      updateListWithFeedback(listId, null, form({ name: "Domingo", description: "E".repeat(LIST_DESCRIPTION_MAX + 1) })),
    );
    assert.match(outcome?.error ?? "", /demasiado larga/);
    const row = await db.query.lists.findFirst({ where: eq(lists.id, listId) });
    assert.equal(row?.description, "Antes");
  });

  it("refuses an over-long Quiero ver note and keeps the old one", async () => {
    const film = await seed.film({ name: "Nota larga" });
    const titleId = await seed.title(userId, film.catalogId);
    await seed.queue(userId, film.catalogId);
    const watchlist = await seed.listOf(userId, WATCHLIST_SLUG);
    await runAsUser(userId, () => updateWatchlistNote(titleId, form({ queueNote: "Con papá" })));
    await assert.rejects(
      runAsUser(userId, () => updateWatchlistNote(titleId, form({ queueNote: "Q".repeat(QUEUE_NOTE_MAX + 1) }))),
      /demasiado larga/,
    );
    const item = await db.query.listItems.findFirst({
      where: and(eq(listItems.listId, watchlist.id), eq(listItems.catalogId, film.catalogId)),
    });
    assert.equal(item?.queueNote, "Con papá");
  });

  it("never stores a lens longer than its maximum", async () => {
    const film = await seed.film({ name: "Lente" });
    const titleId = await seed.title(userId, film.catalogId);
    await runAsUser(userId, () => markNotTonight(titleId, "L".repeat(50_000)));
    const event = await db.query.pickEvents.findFirst({ where: eq(pickEvents.titleId, titleId) });
    assert.ok(event);
    assert.equal(event.lens?.length, PICK_LENS_MAX);
  });
});
