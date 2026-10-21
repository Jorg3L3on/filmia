import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import type { McpToolCall, McpToolDeps } from "@/lib/mcp/define-tool";
import { createMcpEndpoint } from "@/lib/mcp/http";
import { memoryIdempotencyStore } from "@/lib/mcp/idempotency";
import { createPersonalToken } from "@/lib/mcp-oauth/service";
import { memoryRateLimitStore } from "@/lib/rate-limit";
import { TEST_ISSUER, oauthTestbed } from "@/lib/test-support/oauth";

/**
 * An MCP client in memory against the real /api/mcp handler: the client's fetch calls the
 * route handler directly, so transport auth, CORS, the SDK and our tools all run.
 */
export const mcpTestbed = (options: Parameters<typeof oauthTestbed>[0] = {}) => {
  const oauth = oauthTestbed(options);
  const logs: { event: string; data: Record<string, unknown> }[] = [];
  const calls: McpToolCall[] = [];
  const tools: McpToolDeps = {
    rateLimit: memoryRateLimitStore(),
    idempotency: memoryIdempotencyStore(),
    now: oauth.clock.now,
    log: (event, data) => logs.push({ event, data }),
    recordCall: async (call) => {
      calls.push(call);
    },
  };
  const endpoint = createMcpEndpoint({ oauth: oauth.deps.oauth, tools, env: { MCP_ENABLED: "1" } });
  const requests: Request[] = [];

  const fetchImpl = async (input: string | URL | Request, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(input, init);
    requests.push(request.clone());
    if (request.method === "OPTIONS") return endpoint.options(request);
    return endpoint.handle(request);
  };

  const connect = async (token: string, path = "/api/mcp") => {
    const client = new Client({ name: "prueba", version: "1.0.0" });
    const transport = new StreamableHTTPClientTransport(new URL(`${TEST_ISSUER}${path}`), {
      fetch: fetchImpl as typeof fetch,
      authProvider: { token: async () => token },
    });
    await client.connect(transport);
    return client;
  };

  const personalToken = async (userId: string, allowWrite = false) =>
    (await createPersonalToken(oauth.deps.oauth, { userId, name: "Prueba", days: 30, allowWrite })).token;

  return { ...oauth, tools, logs, calls, endpoint, requests, fetchImpl, connect, personalToken };
};

/** JSON-RPC over plain HTTP, for transport-level assertions. */
export const rpc = (method: string, params: Record<string, unknown> = {}, id = 1) =>
  JSON.stringify({ jsonrpc: "2.0", id, method, params });

export const INITIALIZE = rpc("initialize", {
  protocolVersion: "2025-06-18",
  capabilities: {},
  clientInfo: { name: "prueba", version: "1.0.0" },
});

/** The first JSON-RPC message of an SSE or JSON response. */
export const readRpc = async (response: Response) => {
  const text = await response.text();
  const data = text.startsWith("{") ? text : text.split("\n").find((line) => line.startsWith("data: "))?.slice(6);
  return JSON.parse(data ?? "null") as { result?: Record<string, unknown>; error?: unknown };
};

/** Parsed `structuredContent` (or error body) of a tools/call result. */
export const toolData = <T = Record<string, unknown>>(result: unknown) => {
  const value = result as { structuredContent?: unknown; content?: { text: string }[]; isError?: boolean };
  if (value.isError) return JSON.parse(value.content![0]!.text) as T;
  return value.structuredContent as T;
};
