import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SignJWT } from "jose";
import { createSessionToken, verifySessionToken } from "./auth/session-token";

// The secret is read lazily on every sign/verify, so setting it after the import is fine.
process.env.AUTH_SECRET ??= "test-secret-for-session-token-tests";

const user = { id: "u1", email: "ana@correo.com", name: "Ana" };

describe("session token onboarded claim", () => {
  it("round-trips onboarded: false for new accounts", async () => {
    const token = await createSessionToken(user, { onboarded: false });
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
