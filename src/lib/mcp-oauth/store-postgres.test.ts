import { describeWithDb } from "@/lib/test-support/local-db";
import "@/lib/test-support/oauth";
import assert from "node:assert/strict";
import { after, before, it } from "node:test";
import { eq, inArray } from "drizzle-orm";
import { db, mcpOAuthClients, mcpOAuthTokenAttempts, users } from "@/db";
import { closeLocalPg } from "@/db/local-pg";
import { pkcePair } from "@/lib/test-support/oauth";
import {
  createAuthorizationCode,
  createPersonalToken,
  exchangeAuthorizationCode,
  refreshGrant,
  registerClient,
  resolveBearer,
  revokeAgentAccessForUser,
  type OAuthDeps,
} from "./service";
import { postgresOAuthStore } from "./store-postgres";

const USER_ID = "test-mcp-oauth-user";
const REDIRECT = "http://127.0.0.1:4567/cb";
const deps: OAuthDeps = { store: postgresOAuthStore, now: () => new Date() };
const clientIds: string[] = [];

describeWithDb("Postgres OAuth store against the local database (FIL-I20-1)", () => {
  before(async () => {
    await db
      .insert(users)
      .values({ id: USER_ID, email: `${USER_ID}@filmia.test`, name: "Prueba MCP" })
      .onConflictDoNothing();
  });

  after(async () => {
    if (clientIds.length) await db.delete(mcpOAuthClients).where(inArray(mcpOAuthClients.id, clientIds));
    await db.delete(users).where(eq(users.id, USER_ID));
    await closeLocalPg();
  });

  const newFlow = async () => {
    const { client } = await registerClient(deps, { redirect_uris: [REDIRECT], client_name: "Prueba" });
    clientIds.push(client.id);
    const pkce = pkcePair();
    const code = await createAuthorizationCode(deps, {
      clientId: client.id,
      userId: USER_ID,
      redirectUri: REDIRECT,
      codeChallenge: pkce.challenge,
      resource: "https://filmia.test/mcp",
      allowWrite: true,
    });
    const exchange = () =>
      exchangeAuthorizationCode(deps, { code, clientId: client.id, redirectUri: REDIRECT, codeVerifier: pkce.verifier });
    return { client, exchange };
  };

  it("claims a code once under a real race and revokes on replay", async () => {
    const { exchange } = await newFlow();
    const results = await Promise.allSettled([exchange(), exchange(), exchange()]);
    const fulfilled = results.filter((result) => result.status === "fulfilled");
    assert.equal(fulfilled.length, 1);
    const issued = (fulfilled[0] as PromiseFulfilledResult<Awaited<ReturnType<typeof exchange>>>).value;
    const connection = await resolveBearer(deps, issued.access_token);
    assert.equal(connection?.userId, USER_ID);
    assert.equal(connection?.canWrite, true);

    await assert.rejects(exchange(), { reason: "code_reuse" });
    assert.equal(await resolveBearer(deps, issued.access_token), null);
  });

  it("rotates refresh tokens once under a race and revokes on reuse", async () => {
    const { client, exchange } = await newFlow();
    const issued = await exchange();
    const refresh = () => refreshGrant(deps, { refreshToken: issued.refresh_token, clientId: client.id });
    const results = await Promise.allSettled([refresh(), refresh()]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    await assert.rejects(refresh(), { reason: "refresh_reuse" });
  });

  it("revokes grants and personal tokens of the user", async () => {
    const { exchange } = await newFlow();
    const issued = await exchange();
    const personal = await createPersonalToken(deps, { userId: USER_ID, name: "Cursor", days: 30, allowWrite: false });
    assert.ok(await resolveBearer(deps, personal.token));
    const revoked = await revokeAgentAccessForUser(deps, USER_ID, "password_changed");
    assert.ok(revoked.grants >= 1);
    assert.equal(revoked.tokens, 1);
    assert.equal(await resolveBearer(deps, issued.access_token), null);
    assert.equal(await resolveBearer(deps, personal.token), null);
  });

  it("sweeps old token attempts, expired codes and unused DCR clients", async () => {
    const old = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    await db.insert(mcpOAuthTokenAttempts).values({
      id: "test-old-attempt",
      clientIdKind: "dcr",
      hasCode: false,
      hasVerifier: false,
      hasAssertion: false,
      resourceKind: "absent",
      error: "invalid_client",
      httpStatus: 401,
      createdAt: old,
    });
    await db.insert(mcpOAuthClients).values({
      id: "test-stale-dcr",
      clientName: "Viejo",
      redirectUris: [REDIRECT],
      grantTypes: ["authorization_code"],
      responseTypes: ["code"],
      tokenEndpointAuthMethod: "none",
      createdAt: old,
    });
    const counts = await postgresOAuthStore.sweep(new Date());
    assert.ok(counts.tokenAttempts >= 1);
    assert.ok(counts.unusedClients >= 1);
    assert.equal(await postgresOAuthStore.findClient("test-stale-dcr"), null);
  });
});
