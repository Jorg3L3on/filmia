import { and, count, desc, eq, gt, isNull } from "drizzle-orm";
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
  // «Último uso» (FIL-I25-3): lastUsedAt only moves on some paths, so the newest logged call counts too.
  const lastUsed = (id: string, stored: Date | null) => {
    const call = calls.get(id)?.[0]?.createdAt ?? null;
    return stored && (!call || stored > call) ? stored : call;
  };

  const clients: ConnectedClient[] = grants.map(({ grant, client }) => ({
    id: grant.id,
    name: client.clientName,
    host: client.isCimd ? hostOf(client.id) : (hostOf(client.redirectUris[0]) ?? hostOf(client.clientUri)),
    verified: client.isCimd && isTrustedCimdHost(client.id),
    canWrite: grant.allowWrite,
    since: grant.createdAt,
    lastUsedAt: lastUsed(grant.id, grant.lastUsedAt),
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
    lastUsedAt: lastUsed(token.id, token.lastUsedAt),
    lastWhoamiAt: lastWhoami(token.id),
    activity: activityOf(token.id),
  }));

  return { clients, personal };
};

/** Perfil's Conexiones row (FIL-I25-1): how many live apps and tokens, without their activity. */
export const countMcpConnections = async (userId: string, now = new Date()) => {
  const [[apps], [tokens]] = await Promise.all([
    db
      .select({ n: count() })
      .from(mcpOAuthGrants)
      .where(
        and(eq(mcpOAuthGrants.userId, userId), isNull(mcpOAuthGrants.revokedAt), gt(mcpOAuthGrants.refreshExpiresAt, now)),
      ),
    db
      .select({ n: count() })
      .from(mcpPersonalTokens)
      .where(
        and(eq(mcpPersonalTokens.userId, userId), isNull(mcpPersonalTokens.revokedAt), gt(mcpPersonalTokens.expiresAt, now)),
      ),
  ]);
  return { apps: apps?.n ?? 0, tokens: tokens?.n ?? 0 };
};

/** «1 app · 1 token», or «Nada conectado». */
export const connectionsRowSummary = ({ apps, tokens }: { apps: number; tokens: number }) =>
  [apps > 0 ? `${apps} ${apps === 1 ? "app" : "apps"}` : null, tokens > 0 ? `${tokens} ${tokens === 1 ? "token" : "tokens"}` : null]
    .filter(Boolean)
    .join(" · ") || "Nada conectado";

/** Revokes one of the user's grants; false when it is not theirs or already revoked. */
export const revokeUserGrant = async (userId: string, grantId: string, now = new Date()) => {
  const revoked = await db
    .update(mcpOAuthGrants)
    .set({ revokedAt: now, revokedReason: "user_revoked" })
    .where(and(eq(mcpOAuthGrants.id, grantId), eq(mcpOAuthGrants.userId, userId), isNull(mcpOAuthGrants.revokedAt)))
    .returning({ id: mcpOAuthGrants.id });
  return revoked.length === 1;
};
