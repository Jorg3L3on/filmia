import { sweepToolCalls } from "@/lib/mcp/activity";
import { sweepIdempotencyKeys } from "@/lib/mcp/idempotency";
import { postgresOAuthStore } from "@/lib/mcp-oauth/store-postgres";

/**
 * Daily cleanup for the MCP connector (FIL-I20), run by the watch-providers cron: token
 * attempts past 30 days, expired codes, dead grants past 90 days, DCR clients never used,
 * tool calls past 90 days and idempotency keys past 24 h.
 */
export const runMcpRetention = async (now = new Date()) => ({
  oauth: await postgresOAuthStore.sweep(now),
  toolCalls: await sweepToolCalls(now),
  idempotencyKeys: await sweepIdempotencyKeys(now),
});
