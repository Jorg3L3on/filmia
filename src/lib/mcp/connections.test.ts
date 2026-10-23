import { describeWithDb } from "@/lib/test-support/local-db";
import "@/lib/test-support/oauth";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, mcpToolCalls } from "@/db";
import { closeLocalPg } from "@/db/local-pg";
import { INITIALIZE, mcpTestbed, toolData } from "@/lib/test-support/mcp";
import { TEST_ISSUER } from "@/lib/test-support/oauth";
import { seeder } from "@/lib/test-support/seed";
import { createPersonalToken } from "@/lib/mcp-oauth/service";
import { postgresOAuthStore } from "@/lib/mcp-oauth/store-postgres";
import { insertToolCall, sweepToolCalls, TOOL_CALL_RETENTION_MS } from "./activity";
import { connectionsRowSummary, countMcpConnections, loadMcpConnections, revokeUserGrant } from "./connections";
import { defineTool, executeTool } from "./define-tool";
import { issuePersonalToken } from "./personal-tokens";

const connection = {
  userId: "user-ana",
  source: "personal_token" as const,
  connectionId: "tok-1",
  clientName: "Cursor",
  scopes: ["read" as const],
  canWrite: false,
  expiresAt: new Date("2030-01-01T00:00:00Z"),
};

const echo = defineTool({
  name: "eco",
  title: "Eco",
  description: "Tool de prueba que siempre responde lo mismo, para la bitácora de actividad.",
  scope: "read",
  input: {},
  output: { ok: z.boolean().describe("Siempre true.") },
  run: async () => ({ ok: true }),
});

describe("Perfil → Conexiones (FIL-I20-6)", () => {
  it("records one activity row per tools/call, and a failing insert never changes the answer", async () => {
    const bed = mcpTestbed();
    await executeTool(echo, bed.tools, connection, {});
    assert.equal(bed.calls.length, 1);
    assert.deepEqual(
      { tool: bed.calls[0]!.tool, ok: bed.calls[0]!.ok, connectionId: bed.calls[0]!.connection.connectionId },
      { tool: "eco", ok: true, connectionId: "tok-1" },
    );

    bed.tools.recordCall = async () => {
      throw new Error("insert failed: relation McpToolCall does not exist");
    };
    const result = await executeTool(echo, bed.tools, connection, {});
    assert.deepEqual(toolData(result), { ok: true });
    await new Promise((resolve) => setImmediate(resolve));
    assert.ok(bed.logs.some((entry) => entry.event === "mcp.activity.failed"));
  });

  it("revoking a personal token makes the next call a 401", async () => {
    const bed = mcpTestbed();
    const token = await bed.personalToken("user-ana");
    const post = () =>
      bed.endpoint.handle(
        new Request(`${TEST_ISSUER}/api/mcp`, {
          method: "POST",
          headers: { authorization: `Bearer ${token}`, "content-type": "application/json", accept: "application/json, text/event-stream" },
          body: INITIALIZE,
        }),
      );
    assert.equal((await post()).status, 200);
    const [row] = [...bed.rows.personalTokens.values()];
    await bed.deps.oauth.store.revokePersonalTokens({ id: row!.id, userId: "user-ana" }, new Date());
    assert.equal((await post()).status, 401);
    // Someone else cannot revoke it.
    const other = await bed.personalToken("user-leo");
    const [, leoRow] = [...bed.rows.personalTokens.values()];
    assert.equal(await bed.deps.oauth.store.revokePersonalTokens({ id: leoRow!.id, userId: "user-ana" }, new Date()), 0);
    assert.ok(other);
  });

  it("shows a new token once, keeps prefix + sha256 only, and refuses the 11th in an hour", async () => {
    const bed = mcpTestbed();
    const deps = { ...bed.deps.oauth, rateLimit: bed.deps.rateLimit };
    const created = await issuePersonalToken(deps, "user-ana", { name: "Cursor", days: 30, allowWrite: false });
    assert.ok(created.ok);
    if (created.ok) {
      const stored = [...bed.rows.personalTokens.values()][0]!;
      assert.equal(stored.tokenPrefix, created.prefix);
      assert.equal(JSON.stringify(stored).includes(created.token), false);
    }
    for (let i = 2; i <= 10; i += 1) {
      assert.ok((await issuePersonalToken(deps, "user-ana", { name: `T${i}`, days: 7, allowWrite: false })).ok, `token ${i}`);
    }
    const eleventh = await issuePersonalToken(deps, "user-ana", { name: "T11", days: 7, allowWrite: false });
    assert.deepEqual(eleventh.ok ? null : eleventh.code, "rate_limited");
    const invalid = await issuePersonalToken(deps, "user-leo", { name: "x", days: 45, allowWrite: false });
    assert.deepEqual(invalid.ok ? null : invalid.code, "validation");
  });
});

describeWithDb("Perfil → Conexiones against the local database (FIL-I20-6)", () => {
  const seed = seeder("t-conn");
  let ana: string;
  let leo: string;

  before(async () => {
    ana = await seed.user("Ana");
    leo = await seed.user("Leo");
  });

  after(async () => {
    await seed.cleanup();
    await closeLocalPg();
  });

  it("lists live tokens with their last calls, and the cron deletes calls older than 90 days", async () => {
    const deps = { store: postgresOAuthStore, now: () => new Date() };
    const token = await createPersonalToken(deps, { userId: ana, name: "Cursor", days: 30, allowWrite: true });
    await insertToolCall({ userId: ana, source: "personal_token", connectionId: token.id, tool: "whoami", ok: true, errorCode: null, durationMs: 12 });
    const old = new Date(Date.now() - TOOL_CALL_RETENTION_MS - 60_000);
    await db.insert(mcpToolCalls).values({
      id: `${ana}-old`,
      userId: ana,
      source: "personal_token",
      connectionId: token.id,
      tool: "get_tonight",
      ok: true,
      durationMs: 5,
      createdAt: old,
    });

    const { personal, clients } = await loadMcpConnections(ana);
    assert.equal(clients.length, 0);
    assert.equal(personal.length, 1);
    assert.equal(personal[0]!.canWrite, true);
    assert.deepEqual(personal[0]!.activity.map((call) => call.tool), ["whoami", "get_tonight"]);
    assert.ok(personal[0]!.lastWhoamiAt);
    // FIL-I25-3: never «Nunca» next to logged calls; the newest call stands in for lastUsedAt.
    assert.deepEqual(personal[0]!.lastUsedAt, personal[0]!.activity[0]!.at);
    assert.deepEqual(await countMcpConnections(ana), { apps: 0, tokens: 1 });
    assert.equal((await loadMcpConnections(leo)).personal.length, 0, "never someone else's");

    assert.ok((await sweepToolCalls(new Date())) >= 1);
    const left = await db.select().from(mcpToolCalls).where(eq(mcpToolCalls.userId, ana));
    assert.deepEqual(left.map((row) => row.tool), ["whoami"]);
    assert.equal(await revokeUserGrant(leo, "not-a-grant"), false);
  });
});

describe("Perfil «Conexiones ›» summary (FIL-I25-1)", () => {
  it("counts apps and tokens, and says «Nada conectado» with neither", () => {
    assert.equal(connectionsRowSummary({ apps: 1, tokens: 1 }), "1 app · 1 token");
    assert.equal(connectionsRowSummary({ apps: 2, tokens: 0 }), "2 apps");
    assert.equal(connectionsRowSummary({ apps: 0, tokens: 3 }), "3 tokens");
    assert.equal(connectionsRowSummary({ apps: 0, tokens: 0 }), "Nada conectado");
  });
});
