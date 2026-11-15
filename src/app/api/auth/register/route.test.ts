import "@/lib/test-support/local-db";

import assert from "node:assert/strict";
import { after, before, it } from "node:test";
import { eq } from "drizzle-orm";
import { db, users } from "@/db";
import { closeLocalPg } from "@/db/local-pg";
import { describeWithDb } from "@/lib/test-support/local-db";
import { SIGNUP_EMAIL_UNAVAILABLE } from "@/lib/signup-validation";
import { seeder } from "@/lib/test-support/seed";
import { POST } from "./route";

process.env.AUTH_SECRET ??= "test-secret-for-register-route";

const register = (email: string) => {
  const body = new FormData();
  body.set("email", email);
  body.set("password", "una-clave-larga-123");
  body.set("name", "Prueba");
  return POST(
    new Request("http://localhost/api/auth/register", {
      method: "POST",
      body,
      headers: { "x-forwarded-for": `10.41.11.${Math.floor(Math.random() * 250)}` },
    }),
  );
};

describeWithDb("POST /api/auth/register does not tell how an email signs in (FIL-I41-11)", () => {
  const seed = seeder("t-register");
  let passwordEmail = "";
  let googleEmail = "";

  before(async () => {
    const withPassword = await seed.user("Pat");
    const withGoogle = await seed.user("Gus");
    await db.update(users).set({ passwordHash: "x" }).where(eq(users.id, withPassword));
    await db.update(users).set({ passwordHash: null, googleId: `g-${withGoogle}` }).where(eq(users.id, withGoogle));
    passwordEmail = `${withPassword}@filmia.test`;
    googleEmail = `${withGoogle}@filmia.test`;
  });

  after(async () => {
    await seed.cleanup();
    await closeLocalPg();
  });

  it("answers a password account and a Google-only account the same way, with no account flag", async () => {
    const [byPassword, byGoogle] = await Promise.all([register(passwordEmail), register(googleEmail)]);
    assert.equal(byPassword.status, byGoogle.status);
    assert.notEqual(byPassword.status, 409);
    const [a, b] = await Promise.all([byPassword.json(), byGoogle.json()]);
    assert.deepEqual(a, b);
    assert.equal("existingAccount" in a, false);
    assert.doesNotMatch(JSON.stringify(a), /Google|Ya existe/);
  });
});

describeWithDb("POST /api/auth/register refuses an unclaimed ADMIN_EMAILS address (FIL-46)", () => {
  const unclaimed = "t-register-admin-libre@filmia.test";
  const previous = process.env.ADMIN_EMAILS;

  before(() => {
    process.env.ADMIN_EMAILS = ` ${unclaimed.toUpperCase()} `;
  });

  after(async () => {
    process.env.ADMIN_EMAILS = previous;
    await db.delete(users).where(eq(users.email, unclaimed));
    await closeLocalPg();
  });

  it("answers like a taken email and creates no account", async () => {
    const response = await register(unclaimed);
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.deepEqual(body, { error: SIGNUP_EMAIL_UNAVAILABLE, fieldErrors: { email: SIGNUP_EMAIL_UNAVAILABLE } });
    assert.equal(await db.query.users.findFirst({ where: eq(users.email, unclaimed), columns: { id: true } }), undefined);
  });
});
