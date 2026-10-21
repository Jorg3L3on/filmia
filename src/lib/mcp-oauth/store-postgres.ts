import { createId } from "@paralleldrive/cuid2";
import { and, eq, isNull, lt, or } from "drizzle-orm";
import {
  db,
  mcpOAuthAuthorizationCodes,
  mcpOAuthClients,
  mcpOAuthGrants,
  mcpOAuthTokenAttempts,
  mcpPersonalTokens,
} from "@/db";
import { RETENTION } from "@/lib/mcp-oauth/config";
import type { OAuthStore } from "@/lib/mcp-oauth/store";

/** The OAuth store on Neon. One-time transitions are single conditional statements. */
export const postgresOAuthStore: OAuthStore = {
  findClient: async (id) =>
    (await db.query.mcpOAuthClients.findFirst({ where: eq(mcpOAuthClients.id, id) })) ?? null,

  saveClient: async (client) => {
    const [row] = await db
      .insert(mcpOAuthClients)
      .values(client)
      .onConflictDoUpdate({ target: mcpOAuthClients.id, set: { ...client, id: undefined } })
      .returning();
    return row!;
  },

  markClientUsed: async (id, at) => {
    await db
      .update(mcpOAuthClients)
      .set({ firstTokenAt: at })
      .where(and(eq(mcpOAuthClients.id, id), isNull(mcpOAuthClients.firstTokenAt)));
  },

  createCode: async (code) => {
    await db.insert(mcpOAuthAuthorizationCodes).values(code);
  },

  findCodeByHash: async (codeHash) =>
    (await db.query.mcpOAuthAuthorizationCodes.findFirst({
      where: eq(mcpOAuthAuthorizationCodes.codeHash, codeHash),
    })) ?? null,

  claimCode: async (id, at) => {
    const claimed = await db
      .update(mcpOAuthAuthorizationCodes)
      .set({ usedAt: at })
      .where(and(eq(mcpOAuthAuthorizationCodes.id, id), isNull(mcpOAuthAuthorizationCodes.usedAt)))
      .returning({ id: mcpOAuthAuthorizationCodes.id });
    return claimed.length === 1;
  },

  createGrant: async (grant) => {
    await db.insert(mcpOAuthGrants).values(grant);
  },

  findGrantByTokenPrefix: async (tokenPrefix) => {
    const [row] = await db
      .select({ grant: mcpOAuthGrants, clientName: mcpOAuthClients.clientName })
      .from(mcpOAuthGrants)
      .innerJoin(mcpOAuthClients, eq(mcpOAuthClients.id, mcpOAuthGrants.clientId))
      .where(eq(mcpOAuthGrants.tokenPrefix, tokenPrefix))
      .limit(1);
    return row ? { ...row.grant, clientName: row.clientName } : null;
  },

  findGrantByRefreshHash: async (hash) =>
    (await db.query.mcpOAuthGrants.findFirst({ where: eq(mcpOAuthGrants.refreshTokenHash, hash) })) ?? null,

  findGrantByPreviousRefreshHash: async (hash) =>
    (await db.query.mcpOAuthGrants.findFirst({
      where: eq(mcpOAuthGrants.previousRefreshTokenHash, hash),
    })) ?? null,

  rotateGrant: async (id, presentedRefreshHash, next) => {
    const rotated = await db
      .update(mcpOAuthGrants)
      .set({ ...next, previousRefreshTokenHash: presentedRefreshHash })
      .where(
        and(
          eq(mcpOAuthGrants.id, id),
          eq(mcpOAuthGrants.refreshTokenHash, presentedRefreshHash),
          isNull(mcpOAuthGrants.revokedAt),
        ),
      )
      .returning({ id: mcpOAuthGrants.id });
    return rotated.length === 1;
  },

  revokeGrants: async (where, at, reason) => {
    const target =
      "id" in where
        ? eq(mcpOAuthGrants.id, where.id)
        : "authorizationCodeId" in where
          ? eq(mcpOAuthGrants.authorizationCodeId, where.authorizationCodeId)
          : eq(mcpOAuthGrants.userId, where.userId);
    const revoked = await db
      .update(mcpOAuthGrants)
      .set({ revokedAt: at, revokedReason: reason })
      .where(and(target, isNull(mcpOAuthGrants.revokedAt)))
      .returning({ id: mcpOAuthGrants.id });
    return revoked.length;
  },

  touchGrant: async (id, at) => {
    await db.update(mcpOAuthGrants).set({ lastUsedAt: at }).where(eq(mcpOAuthGrants.id, id));
  },

  createPersonalToken: async (token) => {
    await db.insert(mcpPersonalTokens).values(token);
  },

  findPersonalTokenByPrefix: async (tokenPrefix) =>
    (await db.query.mcpPersonalTokens.findFirst({ where: eq(mcpPersonalTokens.tokenPrefix, tokenPrefix) })) ?? null,

  touchPersonalToken: async (id, at) => {
    await db.update(mcpPersonalTokens).set({ lastUsedAt: at }).where(eq(mcpPersonalTokens.id, id));
  },

  revokePersonalTokens: async (where, at) => {
    const target =
      "id" in where
        ? and(eq(mcpPersonalTokens.id, where.id), eq(mcpPersonalTokens.userId, where.userId))
        : eq(mcpPersonalTokens.userId, where.userId);
    const revoked = await db
      .update(mcpPersonalTokens)
      .set({ revokedAt: at })
      .where(and(target, isNull(mcpPersonalTokens.revokedAt)))
      .returning({ id: mcpPersonalTokens.id });
    return revoked.length;
  },

  recordTokenAttempt: async (attempt) => {
    await db.insert(mcpOAuthTokenAttempts).values({ id: createId(), ...attempt });
  },

  sweep: async (now) => {
    const before = (ms: number) => new Date(now.getTime() - ms);
    const [attempts, codes, grants, clients] = await db.batch([
      db
        .delete(mcpOAuthTokenAttempts)
        .where(lt(mcpOAuthTokenAttempts.createdAt, before(RETENTION.tokenAttemptsMs)))
        .returning({ id: mcpOAuthTokenAttempts.id }),
      db
        .delete(mcpOAuthAuthorizationCodes)
        .where(lt(mcpOAuthAuthorizationCodes.expiresAt, now))
        .returning({ id: mcpOAuthAuthorizationCodes.id }),
      db
        .delete(mcpOAuthGrants)
        .where(
          or(
            lt(mcpOAuthGrants.revokedAt, before(RETENTION.deadGrantsMs)),
            lt(mcpOAuthGrants.refreshExpiresAt, before(RETENTION.deadGrantsMs)),
          ),
        )
        .returning({ id: mcpOAuthGrants.id }),
      db
        .delete(mcpOAuthClients)
        .where(
          and(
            eq(mcpOAuthClients.isCimd, false),
            isNull(mcpOAuthClients.firstTokenAt),
            lt(mcpOAuthClients.createdAt, before(RETENTION.unusedDcrClientMs)),
          ),
        )
        .returning({ id: mcpOAuthClients.id }),
    ]);
    return {
      tokenAttempts: attempts.length,
      codes: codes.length,
      deadGrants: grants.length,
      unusedClients: clients.length,
    };
  },
};
