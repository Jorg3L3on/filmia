import "@/lib/test-support/node-async-local-storage";

import assert from "node:assert/strict";
import { after, before, beforeEach, it } from "node:test";
import { eq } from "drizzle-orm";
import { updateAccount } from "@/app/actions/profile";
import { db, users } from "@/db";
import { closeLocalPg } from "@/db/local-pg";
import { describeWithDb } from "@/lib/test-support/local-db";
import { runAsUser } from "@/lib/test-support/run-as-user";
import { seeder } from "@/lib/test-support/seed";

const UNCLAIMED_ADMIN = "t-fil46-admin-libre@filmia.test";

const save = (userId: string, email: string) => {
  const form = new FormData();
  form.set("name", "Prueba");
  form.set("email", email);
  return runAsUser(userId, () => updateAccount(null, form), { pathname: "/perfil" });
};

const emailOf = async (userId: string) =>
  (await db.query.users.findFirst({ where: eq(users.id, userId), columns: { email: true } }))?.email;

describeWithDb("updateAccount keeps ADMIN_EMAILS addresses with their owner (FIL-46)", () => {
  const seed = seeder("t-fil46");
  const previous = process.env.ADMIN_EMAILS;
  let stranger = "";
  let admin = "";
  let adminEmail = "";

  before(async () => {
    stranger = await seed.user("Sam");
    admin = await seed.user("Ada");
    adminEmail = `${admin}@filmia.test`;
  });

  beforeEach(() => {
    process.env.ADMIN_EMAILS = `${UNCLAIMED_ADMIN.toUpperCase()}, ${adminEmail}`;
  });

  after(async () => {
    process.env.ADMIN_EMAILS = previous;
    await seed.cleanup();
    await closeLocalPg();
  });

  it("refuses switching to an unclaimed admin address, with the taken-email answer", async () => {
    const result = await save(stranger, UNCLAIMED_ADMIN);
    assert.deepEqual(result, { error: "Ya existe una cuenta con ese correo." });
    assert.equal(await emailOf(stranger), `${stranger}@filmia.test`);
  });

  it("lets the owner of an admin address save their account and keep it", async () => {
    assert.deepEqual(await save(admin, adminEmail.toUpperCase()), { ok: true });
    assert.equal(await emailOf(admin), adminEmail);
  });

  it("still lets anyone switch to an ordinary unused address", async () => {
    const fresh = `${stranger}-nuevo@filmia.test`;
    assert.deepEqual(await save(stranger, fresh), { ok: true });
    assert.equal(await emailOf(stranger), fresh);
  });
});
