import { postgresOAuthStore } from "@/lib/mcp-oauth/store-postgres";

/**
 * Daily cleanup for the MCP connector (FIL-I20), run by the watch-providers cron: token
 * attempts past 30 days, expired codes, dead grants past 90 days, DCR clients never used.
 */
export const runMcpRetention = async (now = new Date()) => ({
  oauth: await postgresOAuthStore.sweep(now),
});
