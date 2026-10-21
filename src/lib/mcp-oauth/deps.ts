import { postgresRateLimitStore } from "@/lib/rate-limit-store";
import type { OAuthHttpDeps } from "@/lib/mcp-oauth/http";
import type { OAuthDeps } from "@/lib/mcp-oauth/service";
import { postgresOAuthStore } from "@/lib/mcp-oauth/store-postgres";
import { getLiveSessionUser } from "@/lib/session";

/** Production wiring for the OAuth server: Postgres stores, real clock, the Filmia session. */
export const oauthDeps: OAuthDeps = {
  store: postgresOAuthStore,
  now: () => new Date(),
};

export const oauthHttpDeps: OAuthHttpDeps = {
  oauth: oauthDeps,
  rateLimit: postgresRateLimitStore,
  sessionUserId: async () => (await getLiveSessionUser())?.id ?? null,
};
