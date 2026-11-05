import assert from "node:assert/strict";
import { after, before, it } from "node:test";
import { eq } from "drizzle-orm";
import { db, lists } from "@/db";
import { closeLocalPg } from "@/db/local-pg";
import { createListInvite, getInvitePreview, pendingRequestThroughInvite, requestToJoin } from "@/lib/list-invites";
import { describeWithDb } from "@/lib/test-support/local-db";
import { seeder } from "@/lib/test-support/seed";

describeWithDb("/unirse after «Solicitar unirme» on a one-time link (FIL-I41-16)", () => {
  const seed = seeder("t-join-pending");
  let owner = "";
  let guest = "";
  let other = "";
  let listId = "";

  before(async () => {
    owner = await seed.user("Nora");
    guest = await seed.user("Pablo");
    other = await seed.user("Iris");
    listId = await seed.collection(owner, "Maratón de otoño");
  });

  after(async () => {
    await seed.cleanup();
    await closeLocalPg();
  });

  it("the requester still sees the list as pending; another account sees a dead link", async () => {
    const list = (await db.query.lists.findFirst({ where: eq(lists.id, listId) }))!;
    const { token } = await createListInvite({ listId, ownerId: owner, kind: "PERSONAL", role: "EDITOR", list });
    const outcome = await requestToJoin(guest, token);
    assert.equal(outcome.status, "requested");

    // The personal link is used up now: the page's preview is gone…
    assert.equal(await getInvitePreview(token), null);
    // …but the person who asked sees their request (also on a later visit).
    const pending = await pendingRequestThroughInvite(token, guest);
    assert.equal(pending?.id, listId);
    assert.equal(pending?.name, "Maratón de otoño");
    assert.equal((await pendingRequestThroughInvite(token, guest))?.id, listId);

    assert.equal(await pendingRequestThroughInvite(token, other), null);
    assert.equal(await pendingRequestThroughInvite("not-a-token", guest), null);
  });
});
