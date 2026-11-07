import assert from "node:assert/strict";
import { after, it } from "node:test";
import { createId } from "@paralleldrive/cuid2";
import { eq, inArray } from "drizzle-orm";
import { db, users } from "@/db";
import { closeLocalPg } from "@/db/local-pg";
import { authenticateCredentials } from "@/lib/auth/credentials";
import { findOrCreateGoogleUser } from "@/lib/auth/google";
import { hashPassword } from "@/lib/auth/password";
import { createSessionToken, verifySessionToken } from "@/lib/auth/session-token";
import { isSessionCurrent } from "@/lib/auth/session-version";
import { describeWithDb } from "@/lib/test-support/local-db";

process.env.AUTH_SECRET ??= "test-secret-for-google-account-link";

const TAG = "t-glink";
const PASSWORD = "squatter-password-123";

describeWithDb("Google sign-in takes over an account with the same email (H1, FIL-35)", () => {
  const userIds: string[] = [];

  const registerWithPassword = async (sessionVersion = 0) => {
    const id = `${TAG}-${createId().slice(0, 8)}`;
    const email = `${id}@filmia.test`;
    await db.insert(users).values({
      id,
      email,
      name: "Squatter",
      passwordHash: await hashPassword(PASSWORD),
      sessionVersion,
      onboardedAt: new Date(),
    });
    userIds.push(id);
    return { id, email };
  };

  const googleIdentity = (email: string) => ({
    sub: `${TAG}-sub-${createId().slice(0, 8)}`,
    email,
    emailVerified: true,
    name: "Dueña real",
  });

  const sessionOf = async (
    user: { id: string; email: string },
    sessionVersion: number,
  ) => {
    const token = await createSessionToken(
      { id: user.id, email: user.email, name: null },
      { onboarded: true, sessionVersion },
    );
    const session = await verifySessionToken(token);
    assert.ok(session);
    return { id: session.id, sessionVersion: session.sessionVersion };
  };

  after(async () => {
    if (userIds.length) await db.delete(users).where(inArray(users.id, userIds));
    await closeLocalPg();
  });

  it("drops the password and bumps sessionVersion when linking by email", async () => {
    const squatter = await registerWithPassword(2);
    const identity = googleIdentity(squatter.email);

    const result = await findOrCreateGoogleUser(identity);

    assert.equal(result.created, false);
    assert.equal(result.user.id, squatter.id);
    assert.equal(result.sessionVersion, 3);
    const row = await db.query.users.findFirst({
      where: eq(users.id, squatter.id),
      columns: { passwordHash: true, googleId: true, sessionVersion: true, name: true },
    });
    assert.deepEqual(row, {
      passwordHash: null,
      googleId: identity.sub,
      sessionVersion: 3,
      name: "Squatter",
    });
  });

  it("locks the squatter out: password login fails and the old session is revoked", async () => {
    const squatter = await registerWithPassword();
    assert.equal((await authenticateCredentials(squatter.email, PASSWORD)).ok, true);
    const squatterSession = await sessionOf(squatter, 0);
    assert.equal(await isSessionCurrent(squatterSession), true);

    const { sessionVersion } = await findOrCreateGoogleUser(googleIdentity(squatter.email));

    assert.equal((await authenticateCredentials(squatter.email, PASSWORD)).ok, false);
    assert.equal(await isSessionCurrent(squatterSession), false);
    // The callback mints the Google user's cookie with the returned version: it stays signed in.
    assert.equal(await isSessionCurrent(await sessionOf(squatter, sessionVersion)), true);
  });

  it("leaves an account already linked by Google id untouched", async () => {
    const owner = await registerWithPassword();
    const identity = googleIdentity(owner.email);
    const first = await findOrCreateGoogleUser(identity);

    const again = await findOrCreateGoogleUser(identity);

    assert.equal(again.user.id, owner.id);
    assert.equal(again.sessionVersion, first.sessionVersion);
    const row = await db.query.users.findFirst({
      where: eq(users.id, owner.id),
      columns: { sessionVersion: true },
    });
    assert.equal(row?.sessionVersion, first.sessionVersion);
  });

  it("creates a password-less account at sessionVersion 0 for a new email", async () => {
    const email = `${TAG}-new-${createId().slice(0, 8)}@filmia.test`;

    const result = await findOrCreateGoogleUser(googleIdentity(email));
    userIds.push(result.user.id);

    assert.equal(result.created, true);
    assert.equal(result.sessionVersion, 0);
    const row = await db.query.users.findFirst({
      where: eq(users.id, result.user.id),
      columns: { passwordHash: true, sessionVersion: true },
    });
    assert.deepEqual(row, { passwordHash: null, sessionVersion: 0 });
  });
});
