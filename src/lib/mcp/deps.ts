import { recordToolCallAfterResponse } from "@/lib/mcp/activity";
import type { McpToolDeps } from "@/lib/mcp/define-tool";
import { postgresIdempotencyStore } from "@/lib/mcp/idempotency";
import { oauthDeps } from "@/lib/mcp-oauth/deps";
import { postgresRateLimitStore } from "@/lib/rate-limit-store";

/** Production wiring for the MCP tools. */
export const mcpToolDeps: McpToolDeps = {
  rateLimit: postgresRateLimitStore,
  idempotency: postgresIdempotencyStore,
  now: () => new Date(),
  log: (event, data) => console.error(JSON.stringify({ event, ...data, at: new Date().toISOString() })),
  recordCall: recordToolCallAfterResponse,
};

export const mcpEndpointDeps = { oauth: oauthDeps, tools: mcpToolDeps };
