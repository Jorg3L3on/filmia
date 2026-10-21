import type {
  McpOAuthAuthorizationCodeRow,
  McpOAuthClientRow,
  McpOAuthGrantRow,
  McpPersonalTokenRow,
} from "@/db/schema";
import { RETENTION } from "@/lib/mcp-oauth/config";

/**
 * Persistence for the OAuth server, injected so the protocol logic (`service.ts`) is tested
 * against memory and runs against Postgres (`store-postgres.ts`). Every method that guards a
 * one-time transition (claim a code, rotate a refresh token) is a single conditional write.
 */

export type ClientRecord = McpOAuthClientRow;
export type CodeRecord = McpOAuthAuthorizationCodeRow;
export type GrantRecord = McpOAuthGrantRow;
export type PersonalTokenRecord = McpPersonalTokenRow;
export type GrantWithClient = GrantRecord & { clientName: string };

export type GrantRotation = {
  tokenPrefix: string;
  tokenHash: string;
  refreshTokenHash: string;
  expiresAt: Date;
  refreshExpiresAt: Date;
};

export type TokenAttemptRecord = {
  grantType: string | null;
  clientIdKind: string;
  hasCode: boolean;
  hasVerifier: boolean;
  hasAssertion: boolean;
  resourceKind: string;
  error: string;
  invalidGrantReason: string | null;
  httpStatus: number;
};

export type SweepCounts = {
  tokenAttempts: number;
  codes: number;
  unusedClients: number;
  deadGrants: number;
};

export type OAuthStore = {
  findClient: (id: string) => Promise<ClientRecord | null>;
  /** Insert, or replace every field of an existing client (CIMD re-fetch). */
  saveClient: (client: Omit<ClientRecord, "createdAt" | "firstTokenAt">) => Promise<ClientRecord>;
  markClientUsed: (id: string, at: Date) => Promise<void>;

  createCode: (code: Omit<CodeRecord, "createdAt" | "usedAt">) => Promise<void>;
  findCodeByHash: (codeHash: string) => Promise<CodeRecord | null>;
  /** `usedAt = at WHERE id AND usedAt IS NULL`; true only for the caller that won. */
  claimCode: (id: string, at: Date) => Promise<boolean>;

  createGrant: (grant: Omit<GrantRecord, "createdAt" | "lastUsedAt" | "revokedAt" | "revokedReason">) => Promise<void>;
  findGrantByTokenPrefix: (tokenPrefix: string) => Promise<GrantWithClient | null>;
  findGrantByRefreshHash: (refreshTokenHash: string) => Promise<GrantRecord | null>;
  findGrantByPreviousRefreshHash: (refreshTokenHash: string) => Promise<GrantRecord | null>;
  /** Rotate only while the presented refresh hash is current and the grant is live. */
  rotateGrant: (id: string, presentedRefreshHash: string, next: GrantRotation) => Promise<boolean>;
  revokeGrants: (
    where: { id: string } | { authorizationCodeId: string } | { userId: string },
    at: Date,
    reason: string,
  ) => Promise<number>;
  touchGrant: (id: string, at: Date) => Promise<void>;

  createPersonalToken: (token: Omit<PersonalTokenRecord, "createdAt" | "lastUsedAt" | "revokedAt">) => Promise<void>;
  findPersonalTokenByPrefix: (tokenPrefix: string) => Promise<PersonalTokenRecord | null>;
  touchPersonalToken: (id: string, at: Date) => Promise<void>;
  revokePersonalTokens: (where: { id: string; userId: string } | { userId: string }, at: Date) => Promise<number>;

  recordTokenAttempt: (attempt: TokenAttemptRecord) => Promise<void>;
  sweep: (now: Date) => Promise<SweepCounts>;
};

/** Same semantics as the Postgres store, for tests. `rows` is exposed for assertions. */
export const memoryOAuthStore = () => {
  const clients = new Map<string, ClientRecord>();
  const codes = new Map<string, CodeRecord>();
  const grants = new Map<string, GrantRecord>();
  const personalTokens = new Map<string, PersonalTokenRecord>();
  const tokenAttempts: (TokenAttemptRecord & { createdAt: Date })[] = [];
  const clock = { now: () => new Date() };

  const live = (grant: GrantRecord) => grant.revokedAt == null;

  const store: OAuthStore = {
    findClient: async (id) => clients.get(id) ?? null,
    saveClient: async (client) => {
      const existing = clients.get(client.id);
      const row: ClientRecord = {
        ...client,
        createdAt: existing?.createdAt ?? clock.now(),
        firstTokenAt: existing?.firstTokenAt ?? null,
      };
      clients.set(client.id, row);
      return row;
    },
    markClientUsed: async (id, at) => {
      const client = clients.get(id);
      if (client && !client.firstTokenAt) client.firstTokenAt = at;
    },

    createCode: async (code) => {
      codes.set(code.id, { ...code, usedAt: null, createdAt: clock.now() });
    },
    findCodeByHash: async (codeHash) => [...codes.values()].find((code) => code.codeHash === codeHash) ?? null,
    claimCode: async (id, at) => {
      const code = codes.get(id);
      if (!code || code.usedAt) return false;
      code.usedAt = at;
      return true;
    },

    createGrant: async (grant) => {
      grants.set(grant.id, { ...grant, createdAt: clock.now(), lastUsedAt: null, revokedAt: null, revokedReason: null });
    },
    findGrantByTokenPrefix: async (tokenPrefix) => {
      const grant = [...grants.values()].find((row) => row.tokenPrefix === tokenPrefix);
      return grant ? { ...grant, clientName: clients.get(grant.clientId)?.clientName ?? "" } : null;
    },
    findGrantByRefreshHash: async (hash) => [...grants.values()].find((row) => row.refreshTokenHash === hash) ?? null,
    findGrantByPreviousRefreshHash: async (hash) =>
      [...grants.values()].find((row) => row.previousRefreshTokenHash === hash) ?? null,
    rotateGrant: async (id, presentedRefreshHash, next) => {
      const grant = grants.get(id);
      if (!grant || !live(grant) || grant.refreshTokenHash !== presentedRefreshHash) return false;
      Object.assign(grant, next, { previousRefreshTokenHash: presentedRefreshHash });
      return true;
    },
    revokeGrants: async (where, at, reason) => {
      let count = 0;
      for (const grant of grants.values()) {
        const match =
          "id" in where
            ? grant.id === where.id
            : "authorizationCodeId" in where
              ? grant.authorizationCodeId === where.authorizationCodeId
              : grant.userId === where.userId;
        if (match && live(grant)) {
          grant.revokedAt = at;
          grant.revokedReason = reason;
          count += 1;
        }
      }
      return count;
    },
    touchGrant: async (id, at) => {
      const grant = grants.get(id);
      if (grant) grant.lastUsedAt = at;
    },

    createPersonalToken: async (token) => {
      personalTokens.set(token.id, { ...token, createdAt: clock.now(), lastUsedAt: null, revokedAt: null });
    },
    findPersonalTokenByPrefix: async (prefix) =>
      [...personalTokens.values()].find((row) => row.tokenPrefix === prefix) ?? null,
    touchPersonalToken: async (id, at) => {
      const token = personalTokens.get(id);
      if (token) token.lastUsedAt = at;
    },
    revokePersonalTokens: async (where, at) => {
      let count = 0;
      for (const token of personalTokens.values()) {
        const match = "id" in where ? token.id === where.id && token.userId === where.userId : token.userId === where.userId;
        if (match && !token.revokedAt) {
          token.revokedAt = at;
          count += 1;
        }
      }
      return count;
    },

    recordTokenAttempt: async (attempt) => {
      tokenAttempts.push({ ...attempt, createdAt: clock.now() });
    },
    sweep: async (now) => {
      const before = (ms: number) => new Date(now.getTime() - ms);
      const counts: SweepCounts = { tokenAttempts: 0, codes: 0, unusedClients: 0, deadGrants: 0 };
      for (let i = tokenAttempts.length - 1; i >= 0; i -= 1) {
        if (tokenAttempts[i]!.createdAt < before(RETENTION.tokenAttemptsMs)) {
          tokenAttempts.splice(i, 1);
          counts.tokenAttempts += 1;
        }
      }
      for (const [id, code] of codes) {
        if (code.expiresAt < now) {
          codes.delete(id);
          counts.codes += 1;
        }
      }
      for (const [id, grant] of grants) {
        const deadSince = grant.revokedAt ?? grant.refreshExpiresAt;
        if (deadSince < before(RETENTION.deadGrantsMs)) {
          grants.delete(id);
          counts.deadGrants += 1;
        }
      }
      for (const [id, client] of clients) {
        if (!client.isCimd && !client.firstTokenAt && client.createdAt < before(RETENTION.unusedDcrClientMs)) {
          clients.delete(id);
          counts.unusedClients += 1;
        }
      }
      return counts;
    },
  };

  return { store, rows: { clients, codes, grants, personalTokens, tokenAttempts }, clock };
};
