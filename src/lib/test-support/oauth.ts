import "@/lib/test-support/local-db";
import { randomBytes } from "node:crypto";
import type { OAuthHttpDeps } from "@/lib/mcp-oauth/http";
import { memoryOAuthStore } from "@/lib/mcp-oauth/store";
import { pkceChallengeFor } from "@/lib/mcp-oauth/tokens";
import { memoryRateLimitStore } from "@/lib/rate-limit";

export const TEST_ISSUER = "https://filmia.test";

/** Every OAuth/MCP test runs with this public origin, whatever Host a request claims. */
process.env.AUTH_URL = `${TEST_ISSUER}/`;

/**
 * A controllable clock shared by the OAuth deps and the memory store. It starts at the real
 * time unless a date is given: the MCP SDK re-checks `authInfo.expiresAt` against the wall
 * clock, so a clock pinned in the past expired every test token 24 h later (sandbox CI went
 * red on 2026-10-21 for that alone).
 */
export const testClock = (iso?: string) => {
  let now = iso ? new Date(iso) : new Date();
  return {
    now: () => new Date(now),
    advance: (ms: number) => {
      now = new Date(now.getTime() + ms);
    },
  };
};

export const oauthTestbed = (options: { userId?: string | null; enabled?: boolean } = {}) => {
  const clock = testClock();
  const memory = memoryOAuthStore();
  memory.clock.now = clock.now;
  const fetchCalls: string[] = [];
  const documents = new Map<string, unknown>();
  const fetchImpl = async (url: string) => {
    fetchCalls.push(url);
    const doc = documents.get(url);
    return doc === undefined
      ? new Response("not found", { status: 404 })
      : new Response(JSON.stringify(doc), { headers: { "content-type": "application/json" } });
  };
  let sessionUser: string | null = options.userId === undefined ? "user-ana" : options.userId;
  const deps: OAuthHttpDeps = {
    oauth: { store: memory.store, now: clock.now, fetchImpl },
    rateLimit: memoryRateLimitStore(),
    sessionUserId: async () => sessionUser,
    env: { MCP_ENABLED: options.enabled === false ? undefined : "1" },
  };
  return {
    deps,
    clock,
    rows: memory.rows,
    fetchCalls,
    documents,
    signIn: (userId: string | null) => {
      sessionUser = userId;
    },
  };
};

export const pkcePair = () => {
  const verifier = randomBytes(32).toString("base64url");
  return { verifier, challenge: pkceChallengeFor(verifier) };
};

export const jsonRequest = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(`${TEST_ISSUER}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });

export const formRequest = (path: string, fields: Record<string, string>, headers: Record<string, string> = {}) =>
  new Request(`${TEST_ISSUER}${path}`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", ...headers },
    body: new URLSearchParams(fields).toString(),
  });
