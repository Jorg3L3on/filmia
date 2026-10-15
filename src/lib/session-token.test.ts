import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SignJWT } from "jose";
import {
  createSessionToken,
  isSessionVersionCurrent,
  verifySessionToken,
} from "./auth/session-token";

// The secret is read lazily on every sign/verify, so setting it after the import is fine.
process.env.AUTH_SECRET ??= "test-secret-for-session-token-tests";

const user = { id: "u1", email: "ana@correo.com", name: "Ana" };

describe("session token onboarded claim", () => {
  it("round-trips onboarded: false for new accounts", async () => {
    const token = await createSessionToken(user, { onboarded: false, sessionVersion: 0 });
    const payload = await verifySessionToken(token);
    assert.equal(payload?.onboarded, false);
    assert.equal(payload?.id, "u1");
  });

  it("defaults to onboarded: true", async () => {
    const payload = await verifySessionToken(await createSessionToken(user));
    assert.equal(payload?.onboarded, true);
  });

  it("treats tokens minted before the claim existed as onboarded", async () => {
    const now = Math.floor(Date.now() / 1000);
    const legacy = await new SignJWT({ id: "u1", email: "ana@correo.com", name: null })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt(now)
      .setExpirationTime(now + 60)
      .sign(new TextEncoder().encode(process.env.AUTH_SECRET));
    const payload = await verifySessionToken(legacy);
    assert.equal(payload?.onboarded, true);
  });
});

describe("session version (FIL-I10-3)", () => {
  it("round-trips the version claim", async () => {
    const token = await createSessionToken(user, { onboarded: true, sessionVersion: 3 });
    assert.equal((await verifySessionToken(token))?.sessionVersion, 3);
  });

  it("reads tokens minted before the claim as version 0", async () => {
    const now = Math.floor(Date.now() / 1000);
    const legacy = await new SignJWT({ id: "u1", email: "ana@correo.com", name: null })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt(now)
      .setExpirationTime(now + 60)
      .sign(new TextEncoder().encode(process.env.AUTH_SECRET));
    assert.equal((await verifySessionToken(legacy))?.sessionVersion, 0);
  });

  it("revokes a session once the account version moves on (password change)", async () => {
    const before = await verifySessionToken(
      await createSessionToken(user, { onboarded: true, sessionVersion: 0 }),
    );
    assert.equal(isSessionVersionCurrent(before!.sessionVersion, 0), true);
    // updatePassword bumps User.sessionVersion to 1 and re-mints only its own cookie.
    assert.equal(isSessionVersionCurrent(before!.sessionVersion, 1), false);
    const reminted = await verifySessionToken(
      await createSessionToken(user, { onboarded: true, sessionVersion: 1 }),
    );
    assert.equal(isSessionVersionCurrent(reminted!.sessionVersion, 1), true);
  });

  it("treats a deleted account as revoked", () => {
    assert.equal(isSessionVersionCurrent(0, null), false);
  });
});
