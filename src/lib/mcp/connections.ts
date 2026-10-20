import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { db, mcpOAuthClients, mcpOAuthGrants, mcpPersonalTokens } from "@/db";
import { recentToolCalls } from "@/lib/mcp/activity";
import { isTrustedCimdHost } from "@/lib/mcp-oauth/clients";

/**
 * What Perfil → Conexiones shows (FIL-I20-6): the OAuth clients a person connected and their
 * personal tokens, each with its last 20 calls. Only live credentials are listed.
 */

export type ConnectionActivity = { tool: string; ok: boolean; errorCode: string | null; at: Date };

export type ConnectedClient = {
  id: string;
  name: string;
  host: string | null;
  verified: boolean;
  canWrite: boolean;
  since: Date;
  lastUsedAt: Date | null;
  lastWhoamiAt: Date | null;
  activity: ConnectionActivity[];
};

export type PersonalTokenSummary = {
  id: string;
  name: string;
  prefix: string;
  canWrite: boolean;
  createdAt: Date;
  expiresAt: Date;
  lastUsedAt: Date | null;
  lastWhoamiAt: Date | null;
  activity: ConnectionActivity[];
};

const hostOf = (value: string | null | undefined) => {
  if (!value) return null;
  try {
    return new URL(value).host || null;
  } catch {
    return null;
  }
};

export const loadMcpConnections = async (userId: string, now = new Date()) => {
  const [grants, tokens] = await Promise.all([
    db
      .select({ grant: mcpOAuthGrants, client: mcpOAuthClients })
      .from(mcpOAuthGrants)
      .innerJoin(mcpOAuthClients, eq(mcpOAuthClients.id, mcpOAuthGrants.clientId))
      .where(
        and(
          eq(mcpOAuthGrants.userId, userId),
          isNull(mcpOAuthGrants.revokedAt),
          gt(mcpOAuthGrants.refreshExpiresAt, now),
        ),
      )
      .orderBy(desc(mcpOAuthGrants.createdAt)),
    db
      .select()
      .from(mcpPersonalTokens)
      .where(
        and(
          eq(mcpPersonalTokens.userId, userId),
          isNull(mcpPersonalTokens.revokedAt),
          gt(mcpPersonalTokens.expiresAt, now),
        ),
      )
      .orderBy(desc(mcpPersonalTokens.createdAt)),
  ]);

  const calls = await recentToolCalls(userId, [...grants.map((row) => row.grant.id), ...tokens.map((row) => row.id)]);
  const activityOf = (id: string) =>
    (calls.get(id) ?? []).map((call) => ({ tool: call.tool, ok: call.ok, errorCode: call.errorCode, at: call.createdAt }));
  const lastWhoami = (id: string) => (calls.get(id) ?? []).find((call) => call.tool === "whoami")?.createdAt ?? null;

  const clients: ConnectedClient[] = grants.map(({ grant, client }) => ({
    id: grant.id,
    name: client.clientName,
    host: client.isCimd ? hostOf(client.id) : (hostOf(client.redirectUris[0]) ?? hostOf(client.clientUri)),
    verified: client.isCimd && isTrustedCimdHost(client.id),
    canWrite: grant.allowWrite,
    since: grant.createdAt,
    lastUsedAt: grant.lastUsedAt,
    lastWhoamiAt: lastWhoami(grant.id),
    activity: activityOf(grant.id),
  }));

  const personal: PersonalTokenSummary[] = tokens.map((token) => ({
    id: token.id,
    name: token.name,
    prefix: token.tokenPrefix,
    canWrite: token.allowWrite,
    createdAt: token.createdAt,
    expiresAt: token.expiresAt,
    lastUsedAt: token.lastUsedAt,
    lastWhoamiAt: lastWhoami(token.id),
    activity: activityOf(token.id),
  }));

  return { clients, personal };
};

/** Revokes one of the user's grants; false when it is not theirs or already revoked. */
export const revokeUserGrant = async (userId: string, grantId: string, now = new Date()) => {
  const revoked = await db
    .update(mcpOAuthGrants)
    .set({ revokedAt: now, revokedReason: "user_revoked" })
    .where(and(eq(mcpOAuthGrants.id, grantId), eq(mcpOAuthGrants.userId, userId), isNull(mcpOAuthGrants.revokedAt)))
    .returning({ id: mcpOAuthGrants.id });
  return revoked.length === 1;
};
