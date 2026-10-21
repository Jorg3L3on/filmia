import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { describe, it } from "node:test";
import { z } from "zod";
import { INITIALIZE, mcpTestbed, readRpc, rpc, toolData } from "@/lib/test-support/mcp";
import { TEST_ISSUER, pkcePair } from "@/lib/test-support/oauth";
import { createAuthorizationCode, exchangeAuthorizationCode, registerClient } from "@/lib/mcp-oauth/service";
import { decodeCursor, encodeCursor, paginate, queryKey } from "./cursor";
import { defineTool, executeTool, toolAnnotations, type ToolDefinition } from "./define-tool";
import { McpToolError } from "./errors";
import { dateSchema, titleRefSchema } from "./schemas";
import { mcpToolDefinitions } from "./server";

const SNAPSHOT = new URL("./tools-list.snapshot.json", import.meta.url);

const headers = (token?: string, extra: Record<string, string> = {}) => ({
  "content-type": "application/json",
  accept: "application/json, text/event-stream",
  ...(token ? { authorization: `Bearer ${token}` } : {}),
  ...extra,
});

describe("MCP transport (FIL-I20-2)", () => {
  it("answers initialize the same on /mcp and /api/mcp with a valid token", async () => {
    const bed = mcpTestbed();
    const token = await bed.personalToken("user-ana");
    const results = [];
    for (const path of ["/mcp", "/api/mcp"]) {
      const response = await bed.endpoint.handle(
        new Request(`${TEST_ISSUER}${path}`, { method: "POST", headers: headers(token), body: INITIALIZE }),
      );
      assert.equal(response.status, 200, path);
      results.push((await readRpc(response)).result);
    }
    assert.deepEqual(results[0], results[1]);
    assert.deepEqual((results[0] as { serverInfo: unknown }).serverInfo, { name: "filmia", version: "1.0.0" });
  });

  it("answers 401 with resource_metadata of the configured issuer whatever the Host says", async () => {
    const bed = mcpTestbed();
    for (const token of [undefined, "filmia_pat_not-a-real-token-at-all-000000000000"]) {
      const response = await bed.endpoint.handle(
        new Request("http://evil.example/api/mcp", {
          method: "POST",
          headers: headers(token, { host: "evil.example", "x-forwarded-host": "evil.example" }),
          body: INITIALIZE,
        }),
      );
      assert.equal(response.status, 401);
      const challenge = response.headers.get("www-authenticate") ?? "";
      assert.match(challenge, /^Bearer /);
      assert.match(challenge, new RegExp(`resource_metadata="${TEST_ISSUER}/\\.well-known/oauth-protected-resource"`));
      assert.equal(challenge.includes("evil.example"), false);
    }
  });

  it("answers 401 for a token issued for another resource and for a revoked one", async () => {
    const bed = mcpTestbed();
    const post = (bearer: string) =>
      bed.endpoint.handle(
        new Request(`${TEST_ISSUER}/api/mcp`, { method: "POST", headers: headers(bearer), body: INITIALIZE }),
      );

    // An OAuth grant whose audience is another resource server (RFC 8707).
    const { client } = await registerClient(bed.deps.oauth, { redirect_uris: ["https://client.example/cb"] });
    const pkce = pkcePair();
    const code = await createAuthorizationCode(bed.deps.oauth, {
      clientId: client.id,
      userId: "user-ana",
      redirectUri: "https://client.example/cb",
      codeChallenge: pkce.challenge,
      resource: `${TEST_ISSUER}/api/mcp`,
      allowWrite: false,
    });
    const issued = await exchangeAuthorizationCode(bed.deps.oauth, {
      code,
      clientId: client.id,
      redirectUri: "https://client.example/cb",
      codeVerifier: pkce.verifier,
    });
    assert.equal((await post(issued.access_token)).status, 200);
    const grant = [...bed.rows.grants.values()][0]!;
    grant.resource = "https://otro.example/api/mcp";
    assert.equal((await post(issued.access_token)).status, 401);

    const token = await bed.personalToken("user-ana");
    const row = [...bed.rows.personalTokens.values()][0]!;
    row.revokedAt = new Date();
    assert.equal((await post(token)).status, 401);
  });

  it("looks the token up once per HTTP request, never again inside the tool", async () => {
    const bed = mcpTestbed();
    const token = await bed.personalToken("user-ana");
    let lookups = 0;
    const find = bed.deps.oauth.store.findPersonalTokenByPrefix;
    bed.deps.oauth.store.findPersonalTokenByPrefix = async (prefix) => {
      lookups += 1;
      return find(prefix);
    };
    const response = await bed.endpoint.handle(
      new Request(`${TEST_ISSUER}/api/mcp`, {
        method: "POST",
        headers: headers(token),
        body: rpc("tools/call", { name: "whoami", arguments: {} }),
      }),
    );
    await response.text();
    assert.equal(lookups, 1);
    assert.equal(bed.calls.length, 1);
    assert.equal(bed.calls[0]!.connection.connectionId, [...bed.rows.personalTokens.values()][0]!.id);
  });

  it("limits CORS to known origins", async () => {
    const bed = mcpTestbed();
    const preflight = (origin: string) =>
      bed.endpoint.options(new Request(`${TEST_ISSUER}/api/mcp`, { method: "OPTIONS", headers: { origin } }));
    assert.equal(preflight("https://claude.ai").headers.get("access-control-allow-origin"), "https://claude.ai");
    assert.equal(preflight(TEST_ISSUER).headers.get("access-control-allow-origin"), TEST_ISSUER);
    assert.equal(preflight("https://evil.example").headers.get("access-control-allow-origin"), null);
  });

  it("is 404 when MCP_ENABLED is not 1", async () => {
    const { createMcpEndpoint } = await import("./http");
    const bed = mcpTestbed();
    const off = createMcpEndpoint({ oauth: bed.deps.oauth, tools: bed.tools, env: {} });
    const response = await off.handle(new Request(`${TEST_ISSUER}/api/mcp`, { method: "POST", body: INITIALIZE }));
    assert.equal(response.status, 404);
  });
});

/** Every zod field, recursively, with its path. */
const fields = (shape: z.ZodRawShape, path = ""): { path: string; schema: z.ZodType }[] =>
  Object.entries(shape).flatMap(([key, schema]) => {
    const here = `${path}${key}`;
    const inner = unwrap(schema as z.ZodType);
    const nested =
      inner instanceof z.ZodObject
        ? fields(inner.shape, `${here}.`)
        : inner instanceof z.ZodArray && unwrap(inner.element as z.ZodType) instanceof z.ZodObject
          ? fields((unwrap(inner.element as z.ZodType) as z.ZodObject).shape, `${here}[].`)
          : [];
    return [{ path: here, schema: schema as z.ZodType }, ...nested];
  });

const unwrap = (schema: z.ZodType): z.ZodType =>
  schema instanceof z.ZodOptional || schema instanceof z.ZodNullable || schema instanceof z.ZodDefault
    ? unwrap(schema.unwrap() as z.ZodType)
    : schema;

const described = (schema: z.ZodType): boolean =>
  Boolean(schema.description) || (unwrap(schema) !== schema && described(unwrap(schema)));

describe("MCP tool registry coverage", () => {
  const tools = mcpToolDefinitions();

  it("has unique names and at most 20 tools", () => {
    const names = tools.map((tool) => tool.name);
    assert.equal(new Set(names).size, names.length);
    assert.ok(names.length <= 20, `${names.length} tools`);
  });

  for (const tool of tools) {
    it(`${tool.name}: scope, output schema, annotations and descriptions`, () => {
      assert.ok(tool.scope === "read" || tool.scope === "write");
      assert.ok(Object.keys(tool.output).length > 0, "output schema");
      assert.ok(tool.description.length >= 40, "description");
      const annotations = toolAnnotations(tool);
      assert.equal(annotations.openWorldHint, false);
      assert.equal(annotations.readOnlyHint, tool.scope === "read");
      if (tool.scope === "read") assert.equal(annotations.destructiveHint, false);
      for (const field of [...fields(tool.input), ...fields(tool.output)]) {
        assert.ok(described(field.schema), `${tool.name}.${field.path} has no describe()`);
      }
      for (const field of fields(tool.input)) {
        assert.equal(/(^|\.)(user_?id|owner_?id|userId|ownerId)$/i.test(field.path), false, `${tool.name} takes ${field.path}`);
      }
    });
  }
});

const quietDeps = () => {
  const bed = mcpTestbed();
  return bed;
};

const connectionFor = (canWrite = false) => ({
  userId: "user-ana",
  source: "personal_token" as const,
  connectionId: "tok-1",
  clientName: "Prueba",
  scopes: canWrite ? (["read", "write"] as const).slice() : ["read" as const],
  canWrite,
  expiresAt: new Date("2027-01-01T00:00:00Z"),
});

describe("MCP tool contract", () => {
  it("turns a database error into internal and keeps its text in the log only", async () => {
    const bed = quietDeps();
    const failing = defineTool({
      name: "falla",
      title: "Falla",
      description: "Tool de prueba que falla como lo haría una consulta de Drizzle contra Neon.",
      scope: "read",
      input: {},
      output: { ok: z.boolean().describe("nunca") },
      run: async () => {
        throw new Error('Failed query: select "passwordHash" from "User" where "id" = $1\nparams: user-ana');
      },
    });
    const result = await executeTool(failing, bed.tools, connectionFor(), {});
    assert.equal(result.isError, true);
    const body = toolData<{ error: { code: string; message: string } }>(result);
    assert.equal(body.error.code, "internal");
    assert.equal(JSON.stringify(result).includes("passwordHash"), false);
    assert.ok(bed.logs.some((entry) => String(entry.data.message).includes("passwordHash")));
    assert.equal(bed.calls[0]?.errorCode, "internal");
  });

  it("rejects unknown keys and impossible dates as validation", async () => {
    const bed = quietDeps();
    const echo = defineTool({
      name: "eco",
      title: "Eco",
      description: "Tool de prueba que devuelve la fecha que recibe, para validar la entrada estricta.",
      scope: "read",
      input: { date: dateSchema.describe("Una fecha.") },
      output: { date: z.string().describe("La misma fecha.") },
      run: async (_ctx, args) => ({ date: args.date }),
    });
    const extra = toolData<{ error: { code: string } }>(
      await executeTool(echo, bed.tools, connectionFor(), { date: "2026-02-28", user_id: "otro" }),
    );
    assert.equal(extra.error.code, "validation");
    const impossible = toolData<{ error: { code: string } }>(
      await executeTool(echo, bed.tools, connectionFor(), { date: "2026-02-30" }),
    );
    assert.equal(impossible.error.code, "validation");
    assert.equal(dateSchema.safeParse("2024-02-29").success, true);
    assert.equal(dateSchema.safeParse("2026-13-01").success, false);
    assert.deepEqual(toolData(await executeTool(echo, bed.tools, connectionFor(), { date: "2026-02-28" })), {
      date: "2026-02-28",
    });
  });

  it("checks the rate limit before the tool runs, and answers rate_limited", async () => {
    const bed = quietDeps();
    const order: string[] = [];
    const hit = bed.tools.rateLimit.hit;
    bed.tools.rateLimit = {
      hit: async (...args) => {
        order.push("rate_limit");
        return hit(...args);
      },
    };
    const probe = defineTool({
      name: "sonda",
      title: "Sonda",
      description: "Tool de prueba que registra cuándo corre respecto al límite de solicitudes.",
      scope: "read",
      input: {},
      output: { ok: z.boolean().describe("Siempre true.") },
      run: async () => {
        order.push("query");
        return { ok: true };
      },
    });
    await executeTool(probe, bed.tools, connectionFor(), {});
    assert.deepEqual(order, ["rate_limit", "query"]);
    for (let i = 0; i < 130; i += 1) await executeTool(probe, bed.tools, connectionFor(), {});
    const limited = toolData<{ error: { code: string; retry_after_seconds: number } }>(
      await executeTool(probe, bed.tools, connectionFor(), {}),
    );
    assert.equal(limited.error.code, "rate_limited");
    assert.ok(limited.error.retry_after_seconds > 0);
  });

  it("answers writes_disabled for a write tool on a read-only connection without running it", async () => {
    const bed = quietDeps();
    let ran = false;
    const write = defineTool({
      name: "escribe",
      title: "Escribe",
      description: "Tool de prueba de escritura, para comprobar el permiso «Permitir cambios».",
      scope: "write",
      input: {},
      output: { ok: z.boolean().describe("Siempre true.") },
      run: async () => {
        ran = true;
        return { ok: true };
      },
    });
    const denied = toolData<{ error: { code: string } }>(await executeTool(write, bed.tools, connectionFor(false), {}));
    assert.equal(denied.error.code, "writes_disabled");
    assert.equal(ran, false);
    assert.deepEqual(toolData(await executeTool(write, bed.tools, connectionFor(true), {})), { ok: true });
  });

  it("passes McpToolError codes, hints and candidates through", async () => {
    const bed = quietDeps();
    const ambiguous = defineTool({
      name: "ambigua",
      title: "Ambigua",
      description: "Tool de prueba que no sabe a cuál título se refiere y devuelve candidatos.",
      scope: "read",
      input: {},
      output: { ok: z.boolean().describe("nunca") },
      run: async () => {
        throw new McpToolError("validation", "Hay dos títulos con ese nombre.", {
          hint: "Elige uno por id.",
          candidates: [{ id: "a", title: "Dune (2021)" }, { id: "b", title: "Dune (1984)" }],
        });
      },
    });
    const body = toolData<{ error: { candidates: unknown[]; hint: string } }>(
      await executeTool(ambiguous as ToolDefinition, bed.tools, connectionFor(), {}),
    );
    assert.equal(body.error.candidates.length, 2);
    assert.equal(body.error.hint, "Elige uno por id.");
  });

  it("validates title references", () => {
    for (const ok of ["cm4demofilmia00000000001", "tmdb:movie:550", "tmdb:tv:1399"]) {
      assert.equal(titleRefSchema.safeParse(ok).success, true, ok);
    }
    for (const bad of ["tmdb:film:1", "../etc", "550", "tmdb:movie:"]) {
      assert.equal(titleRefSchema.safeParse(bad).success, false, bad);
    }
  });
});

describe("MCP cursors", () => {
  it("pages to the end and refuses a cursor from another query or a forged one", () => {
    const all = Array.from({ length: 7 }, (_, index) => index);
    const key = queryKey("list_library", { status: "pending" });
    const seen: number[] = [];
    let cursor: string | undefined;
    for (;;) {
      const page = paginate(all, key, cursor, 3);
      assert.equal(page.total_count, 7);
      seen.push(...page.items);
      if (!page.next_cursor) break;
      cursor = page.next_cursor;
    }
    assert.deepEqual(seen, all);
    const other = queryKey("list_library", { status: "watched" });
    assert.throws(() => decodeCursor(other, encodeCursor(key, 3)), { code: "validation" });
    const forged = Buffer.from(`${key}.3.AAAAAAAAAAAAAAAAAAAAAA`).toString("base64url");
    assert.throws(() => decodeCursor(key, forged), { code: "validation" });
    assert.equal(queryKey("t", { a: 1, cursor: "x", limit: 3 }), queryKey("t", { a: 1 }));
  });
});

describe("tools/list", () => {
  it("matches the snapshot (names, annotations, required and keys)", async () => {
    const bed = mcpTestbed();
    const client = await bed.connect(await bed.personalToken("user-ana"));
    const listed = await client.listTools();
    await client.close();
    const summary = listed.tools.map((tool) => ({
      name: tool.name,
      title: tool.title,
      annotations: tool.annotations,
      required: (tool.inputSchema as { required?: string[] }).required ?? [],
      input_keys: Object.keys((tool.inputSchema as { properties?: object }).properties ?? {}),
      additional_properties: (tool.inputSchema as { additionalProperties?: unknown }).additionalProperties,
      output_keys: Object.keys((tool.outputSchema as { properties?: object } | undefined)?.properties ?? {}),
      meta: tool._meta ?? null,
    }));
    if (process.env.UPDATE_SNAPSHOTS === "1") {
      await writeFile(SNAPSHOT, `${JSON.stringify(summary, null, 2)}\n`);
    }
    const expected = JSON.parse(await readFile(SNAPSHOT, "utf8"));
    assert.deepEqual(summary, expected);
    for (const tool of summary) assert.equal(tool.additional_properties, false, `${tool.name} is not strict`);
  });

  it("does not depend on the v1 SDK", async () => {
    const pkg = JSON.parse(await readFile(new URL("../../../package.json", import.meta.url), "utf8"));
    assert.equal(pkg.dependencies["@modelcontextprotocol/sdk"], undefined);
    assert.equal(pkg.devDependencies["@modelcontextprotocol/sdk"], undefined);
    assert.ok(pkg.dependencies["@modelcontextprotocol/server"]);
  });
});
