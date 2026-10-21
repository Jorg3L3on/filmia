import { describeWithDb } from "@/lib/test-support/local-db";
import "@/lib/test-support/oauth";
import assert from "node:assert/strict";
import { after, before, it } from "node:test";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { eq, inArray } from "drizzle-orm";
import { db, mcpOAuthClients, mcpToolCalls } from "@/db";
import { closeLocalPg } from "@/db/local-pg";
import { TEST_ISSUER, formRequest, jsonRequest, pkcePair } from "@/lib/test-support/oauth";
import { seeder } from "@/lib/test-support/seed";
import { insertToolCall, toToolCallRow } from "./activity";
import type { McpToolDeps } from "./define-tool";
import { createMcpEndpoint } from "./http";
import { postgresIdempotencyStore } from "./idempotency";
import { MCP_SERVICE_DOCUMENTATION_PATH } from "@/lib/mcp-oauth/config";
import { handleAuthorize, handleAuthorizationServerMetadata, handleConsentPost, handleRegister, handleRevoke, handleToken, type OAuthHttpDeps } from "@/lib/mcp-oauth/http";
import { postgresOAuthStore } from "@/lib/mcp-oauth/store-postgres";
import { memoryRateLimitStore } from "@/lib/rate-limit";

/**
 * End to end against the real handlers and the local database (FIL-I20-7): DCR, authorize →
 * consent → token with PKCE, an MCP client in memory, the tool script, writes without and with
 * «Permitir cambios», and revocation.
 */
describeWithDb("MCP connector end to end (FIL-I20-7)", () => {
  const seed = seeder("t-e2e");
  let userId = "";
  const REDIRECT = "http://127.0.0.1:33418/callback";
  const oauthDeps: OAuthHttpDeps = {
    oauth: { store: postgresOAuthStore, now: () => new Date() },
    rateLimit: memoryRateLimitStore(),
    sessionUserId: async () => userId,
    env: { MCP_ENABLED: "1" },
  };
  const toolDeps: McpToolDeps = {
    rateLimit: memoryRateLimitStore(),
    idempotency: postgresIdempotencyStore,
    now: () => new Date(),
    log: () => undefined,
    recordCall: async (call) => insertToolCall(toToolCallRow(call)),
  };
  const endpoint = createMcpEndpoint({ oauth: oauthDeps.oauth, tools: toolDeps, env: { MCP_ENABLED: "1" } });
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(input, init);
    return request.method === "OPTIONS" ? endpoint.options(request) : endpoint.handle(request);
  }) as typeof fetch;
  const clientIds: string[] = [];
  let toolsListBytes = 0;
  let toolsCount = 0;

  before(async () => {
    userId = await seed.user("Ana", ["NETFLIX"]);
    const film = await seed.film({ name: "Comedia corta", runtime: 98, platforms: ["NETFLIX"], genres: ["Comedia"] });
    await seed.title(userId, film.catalogId);
    await seed.queue(userId, film.catalogId);
  });

  after(async () => {
    if (clientIds.length) await db.delete(mcpOAuthClients).where(inArray(mcpOAuthClients.id, clientIds));
    await seed.cleanup();
    await closeLocalPg();
    console.log(`tools/list: ${toolsCount} tools, ${toolsListBytes} bytes`);
  });

  /** DCR → authorize → consent → token. */
  const connect = async (allowWrite: boolean) => {
    const registered = (await (
      await handleRegister(oauthDeps, jsonRequest("/api/oauth/register", { client_name: "Agente e2e", redirect_uris: [REDIRECT] }))
    ).json()) as { client_id: string };
    clientIds.push(registered.client_id);
    const pkce = pkcePair();
    const params = new URLSearchParams({
      response_type: "code",
      client_id: registered.client_id,
      redirect_uri: REDIRECT,
      code_challenge: pkce.challenge,
      code_challenge_method: "S256",
      state: "e2e",
      scope: "read write",
      resource: `${TEST_ISSUER}/mcp`,
    });
    const authorize = await handleAuthorize(oauthDeps, new Request(`${TEST_ISSUER}/api/oauth/authorize?${params}`));
    assert.equal(authorize.status, 302);
    const consentUrl = new URL(authorize.headers.get("location")!);
    assert.equal(consentUrl.pathname, "/oauth/consent");

    const consent = await handleConsentPost(
      oauthDeps,
      jsonRequest(
        "/api/oauth/consent",
        { ...Object.fromEntries(consentUrl.searchParams), decision: "allow", allow_write: allowWrite },
        { origin: TEST_ISSUER },
      ),
    );
    const back = new URL(((await consent.json()) as { redirect_to: string }).redirect_to);
    assert.equal(back.searchParams.get("state"), "e2e");
    assert.equal(back.searchParams.get("iss"), TEST_ISSUER);

    const token = await handleToken(
      oauthDeps,
      formRequest("/api/oauth/token", {
        grant_type: "authorization_code",
        code: back.searchParams.get("code")!,
        client_id: registered.client_id,
        redirect_uri: REDIRECT,
        code_verifier: pkce.verifier,
        resource: `${TEST_ISSUER}/api/mcp`,
      }),
    );
    assert.equal(token.status, 200);
    return (await token.json()) as { access_token: string; refresh_token: string; scope: string };
  };

  const mcpClient = async (accessToken: string) => {
    const client = new Client({ name: "e2e", version: "1.0.0" });
    await client.connect(
      new StreamableHTTPClientTransport(new URL(`${TEST_ISSUER}/api/mcp`), {
        fetch: fetchImpl,
        authProvider: { token: async () => accessToken },
      }),
    );
    return client;
  };

  const data = (result: unknown) => {
    const value = result as { structuredContent?: Record<string, unknown>; content: { text: string }[]; isError?: boolean };
    return value.isError ? (JSON.parse(value.content[0]!.text) as Record<string, unknown>) : value.structuredContent!;
  };

  it("runs the whole flow: OAuth, the tool script, writes_disabled, writes with permission, revocation", async () => {
    const metadata = (await handleAuthorizationServerMetadata(oauthDeps).json()) as { service_documentation: string };
    assert.equal(metadata.service_documentation, `${TEST_ISSUER}${MCP_SERVICE_DOCUMENTATION_PATH}`);

    // 1. Read-only connection.
    const readOnly = await connect(false);
    assert.equal(readOnly.scope, "read");
    const client = await mcpClient(readOnly.access_token);
    const listed = await client.listTools();
    toolsCount = listed.tools.length;
    toolsListBytes = Buffer.byteLength(JSON.stringify(listed));
    assert.ok(toolsCount <= 20);

    const who = data(await client.callTool({ name: "whoami", arguments: {} }));
    assert.deepEqual(who.user, { name: "Ana" });
    assert.equal((who.connection as { can_write: boolean }).can_write, false);

    const recos = data(await client.callTool({ name: "recommend", arguments: { platforms: ["NETFLIX"], max_runtime_min: 120 } }));
    const first = (recos.results as { id: string; title: string }[])[0]!;
    assert.equal(first.title, "Comedia corta");

    const ficha = data(await client.callTool({ name: "get_title", arguments: { id: first.id } }));
    assert.equal(ficha.status, "pending");

    const denied = data(
      await client.callTool({ name: "mark_seen", arguments: { id: first.id, rating: 8, idempotency_key: "e2e-seen-0001" } }),
    );
    assert.equal((denied.error as { code: string }).code, "writes_disabled");
    await client.close();

    // 2. Reconnect with «Permitir cambios».
    const writable = await connect(true);
    assert.equal(writable.scope, "read write");
    const writer = await mcpClient(writable.access_token);
    const seen = data(
      await writer.callTool({ name: "mark_seen", arguments: { id: first.id, rating: 8, idempotency_key: "e2e-seen-0002" } }),
    );
    assert.equal(seen.rating, 8);
    const after = data(await writer.callTool({ name: "get_title", arguments: { id: first.id } }));
    assert.equal(after.status, "watched");
    assert.equal(after.my_rating, 8);
    await writer.close();

    // 3. Revoke: the next call is a 401.
    const revoked = await handleRevoke(oauthDeps, formRequest("/api/oauth/revoke", { token: writable.refresh_token }));
    assert.equal(revoked.status, 200);
    const afterRevoke = await endpoint.handle(
      new Request(`${TEST_ISSUER}/api/mcp`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${writable.access_token}`,
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
        },
        body: JSON.stringify({ jsonrpc: "2.0", id: 9, method: "tools/call", params: { name: "whoami", arguments: {} } }),
      }),
    );
    assert.equal(afterRevoke.status, 401);

    // Every tools/call left an activity row (FIL-I20-6).
    await new Promise((resolve) => setTimeout(resolve, 200));
    const calls = await db.select().from(mcpToolCalls).where(eq(mcpToolCalls.userId, userId));
    assert.ok(calls.length >= 6, `${calls.length} activity rows`);
    assert.ok(calls.some((call) => call.tool === "mark_seen" && call.errorCode === "writes_disabled"));
    assert.ok(calls.some((call) => call.tool === "mark_seen" && call.ok));
  });
});
