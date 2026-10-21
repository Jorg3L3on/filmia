import { createId } from "@paralleldrive/cuid2";
import { z } from "zod";
import {
  CIMD_CACHE_MS,
  OAUTH_ACCESS_TOKEN_PREFIX,
  OAUTH_ACCESS_TOKEN_TTL_MS,
  OAUTH_CODE_TTL_MS,
  OAUTH_REFRESH_TOKEN_TTL_MS,
  PERSONAL_TOKEN_MAX_DAYS,
  PERSONAL_TOKEN_PREFIX,
  TOKEN_LOOKUP_LENGTH,
  getMcpResourceUrl,
  isOwnMcpResource,
  normalizeMcpResource,
  scopesFor,
  type McpScope,
} from "@/lib/mcp-oauth/config";
import {
  cimdClientIdsMatch,
  clampClientName,
  isAllowedRedirectUri,
  isClientIdMetadataUrl,
  isHttpsUri,
  tokenClientMatchesCode,
} from "@/lib/mcp-oauth/clients";
import { fetchJsonDocument, type FetchLike } from "@/lib/mcp-oauth/fetch-document";
import type { ClientRecord, OAuthStore } from "@/lib/mcp-oauth/store";
import {
  generateAccessToken,
  generateAuthorizationCode,
  generateClientSecret,
  generatePersonalToken,
  generateRefreshToken,
  hashSecret,
  isValidPkceVerifier,
  verifyPkceS256,
  verifySecret,
} from "@/lib/mcp-oauth/tokens";

/**
 * The OAuth 2.1 authorization server behind the MCP connector (FIL-I20-1). Protocol rules
 * live here; route handlers only parse HTTP. Decisión 5b952a3f lists where filmia follows
 * micasa (MIC-I5) and where zigzag (ZIG-I23-11).
 */

export type OAuthDeps = {
  store: OAuthStore;
  now: () => Date;
  fetchImpl?: FetchLike;
};

export type InvalidGrantReason =
  | "not_found"
  | "expired"
  | "redirect"
  | "client"
  | "pkce"
  | "resource"
  | "code_reuse"
  | "refresh_reuse"
  | "revoked"
  | "race";

export class OAuthInvalidGrantError extends Error {
  readonly reason: InvalidGrantReason;

  constructor(reason: InvalidGrantReason) {
    super("invalid_grant");
    this.name = "OAuthInvalidGrantError";
    this.reason = reason;
  }
}

const later = (now: Date, ms: number) => new Date(now.getTime() + ms);

// --- Clients ---------------------------------------------------------------------------------

const cimdDocumentSchema = z
  .object({
    client_id: z.string().url(),
    client_name: z.string().optional(),
    redirect_uris: z.array(z.string()).min(1).max(20),
    grant_types: z.array(z.string()).optional(),
    response_types: z.array(z.string()).optional(),
    token_endpoint_auth_method: z.string().optional(),
    client_uri: z.string().optional(),
    logo_uri: z.string().optional(),
  })
  .passthrough();

const clientFromCimd = (clientId: string, json: unknown, now: Date) => {
  const parsed = cimdDocumentSchema.safeParse(json);
  if (!parsed.success || !cimdClientIdsMatch(clientId, parsed.data.client_id)) return null;
  const doc = parsed.data;
  const redirectUris = doc.redirect_uris.filter(isAllowedRedirectUri);
  if (redirectUris.length === 0) return null;
  return {
    id: clientId,
    clientName: clampClientName(doc.client_name, new URL(clientId).hostname),
    redirectUris,
    grantTypes: doc.grant_types ?? ["authorization_code", "refresh_token"],
    responseTypes: doc.response_types ?? ["code"],
    // CIMD clients are public: private_key_jwt is not supported, PKCE is what authenticates.
    tokenEndpointAuthMethod: "none",
    clientUri: doc.client_uri && isHttpsUri(doc.client_uri) ? doc.client_uri : null,
    logoUri: doc.logo_uri && isHttpsUri(doc.logo_uri) ? doc.logo_uri : null,
    clientSecretHash: null,
    isCimd: true,
    fetchedAt: now,
  };
};

/**
 * A known client from the store, or a CIMD URL fetched (and cached 24 h). `canFetch` runs only
 * when a fetch is needed (the per-IP CIMD rate limit): when it says no, known clients still
 * resolve and new URLs do not. A failed re-fetch keeps the stored client.
 */
export const resolveClient = async (
  deps: OAuthDeps,
  clientId: string,
  { canFetch = async () => true }: { canFetch?: () => Promise<boolean> } = {},
): Promise<ClientRecord | null> => {
  const now = deps.now();
  const existing = await deps.store.findClient(clientId);
  const stale =
    existing?.isCimd && (!existing.fetchedAt || now.getTime() - existing.fetchedAt.getTime() > CIMD_CACHE_MS);
  if (existing && !stale) return existing;
  if (!isClientIdMetadataUrl(clientId) || !(await canFetch())) return existing;

  const fetched = await fetchJsonDocument(clientId, { fetchImpl: deps.fetchImpl });
  if (!fetched.ok) return existing;
  const client = clientFromCimd(clientId, fetched.json, now);
  if (!client) return existing;
  return deps.store.saveClient(client);
};

export const registrationSchema = z
  .object({
    client_name: z.string().max(200).optional(),
    redirect_uris: z
      .array(
        z.string().max(2048).refine(isAllowedRedirectUri, {
          message: "redirect_uri debe ser https, http en loopback o un esquema privado reverse-DNS",
        }),
      )
      .min(1)
      .max(20),
    grant_types: z.array(z.enum(["authorization_code", "refresh_token"])).optional(),
    response_types: z.array(z.literal("code")).optional(),
    token_endpoint_auth_method: z.enum(["none", "client_secret_post"]).optional(),
    client_uri: z.string().max(2048).refine(isHttpsUri, { message: "client_uri debe ser https" }).optional(),
    logo_uri: z.string().max(2048).refine(isHttpsUri, { message: "logo_uri debe ser https" }).optional(),
  })
  .passthrough();

export type RegistrationInput = z.infer<typeof registrationSchema>;

export const registerClient = async (deps: OAuthDeps, input: RegistrationInput) => {
  const authMethod = input.token_endpoint_auth_method ?? "none";
  const clientSecret = authMethod === "client_secret_post" ? generateClientSecret() : null;
  const client = await deps.store.saveClient({
    id: crypto.randomUUID(),
    clientName: clampClientName(input.client_name, "Cliente MCP"),
    redirectUris: input.redirect_uris,
    grantTypes: input.grant_types ?? ["authorization_code", "refresh_token"],
    responseTypes: input.response_types ?? ["code"],
    tokenEndpointAuthMethod: authMethod,
    clientUri: input.client_uri ?? null,
    logoUri: input.logo_uri ?? null,
    clientSecretHash: clientSecret ? hashSecret(clientSecret) : null,
    isCimd: false,
    fetchedAt: null,
  });
  return { client, clientSecret };
};

/** Public clients (`none`) authenticate with PKCE alone; confidential ones also with the secret. */
export const verifyClientSecret = (client: ClientRecord, secret: string | null | undefined) => {
  if (client.tokenEndpointAuthMethod !== "client_secret_post") return true;
  return Boolean(client.clientSecretHash && secret && verifySecret(secret, client.clientSecretHash));
};

// --- Authorization codes ---------------------------------------------------------------------

export const createAuthorizationCode = async (
  deps: OAuthDeps,
  input: {
    clientId: string;
    userId: string;
    redirectUri: string;
    codeChallenge: string;
    resource: string;
    allowWrite: boolean;
  },
) => {
  const now = deps.now();
  const code = generateAuthorizationCode();
  await deps.store.createCode({
    id: createId(),
    codeHash: code.tokenHash,
    clientId: input.clientId,
    userId: input.userId,
    redirectUri: input.redirectUri,
    codeChallenge: input.codeChallenge,
    resource: normalizeMcpResource(input.resource),
    allowWrite: input.allowWrite,
    expiresAt: later(now, OAUTH_CODE_TTL_MS),
  });
  return code.token;
};

export type TokenResponse = {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  refresh_token: string;
  scope: string;
};

const issueGrant = async (
  deps: OAuthDeps,
  input: { userId: string; clientId: string; allowWrite: boolean; resource: string; authorizationCodeId: string },
): Promise<TokenResponse> => {
  const now = deps.now();
  const access = generateAccessToken();
  const refresh = generateRefreshToken();
  await deps.store.createGrant({
    id: createId(),
    userId: input.userId,
    clientId: input.clientId,
    authorizationCodeId: input.authorizationCodeId,
    tokenPrefix: access.tokenPrefix,
    tokenHash: access.tokenHash,
    refreshTokenHash: refresh.tokenHash,
    previousRefreshTokenHash: null,
    allowWrite: input.allowWrite,
    resource: input.resource,
    expiresAt: later(now, OAUTH_ACCESS_TOKEN_TTL_MS),
    refreshExpiresAt: later(now, OAUTH_REFRESH_TOKEN_TTL_MS),
  });
  await deps.store.markClientUsed(input.clientId, now);
  return {
    access_token: access.token,
    token_type: "Bearer",
    expires_in: OAUTH_ACCESS_TOKEN_TTL_MS / 1000,
    refresh_token: refresh.token,
    scope: scopesFor(input.allowWrite).join(" "),
  };
};

/**
 * authorization_code grant. Every check runs before the code is claimed, so a malformed request
 * does not burn it; the claim itself is the single-use gate. PKCE is mandatory: nothing (a
 * client_assertion included) replaces the code_verifier. A code presented again after use
 * revokes every grant it produced (OAuth 2.1 §4.1.2).
 */
export const exchangeAuthorizationCode = async (
  deps: OAuthDeps,
  input: {
    code: string;
    clientId: string;
    redirectUri: string;
    codeVerifier?: string | null;
    resource?: string | null;
  },
): Promise<TokenResponse> => {
  const now = deps.now();
  const row = await deps.store.findCodeByHash(hashSecret(input.code));
  if (!row) throw new OAuthInvalidGrantError("not_found");
  if (row.usedAt) {
    await deps.store.revokeGrants({ authorizationCodeId: row.id }, now, "code_reuse");
    throw new OAuthInvalidGrantError("code_reuse");
  }
  if (row.expiresAt.getTime() <= now.getTime()) throw new OAuthInvalidGrantError("expired");
  if (!tokenClientMatchesCode(input.clientId, row.clientId)) throw new OAuthInvalidGrantError("client");
  if (row.redirectUri !== input.redirectUri) throw new OAuthInvalidGrantError("redirect");
  if (!isValidPkceVerifier(input.codeVerifier) || !verifyPkceS256(input.codeVerifier, row.codeChallenge)) {
    throw new OAuthInvalidGrantError("pkce");
  }
  if (input.resource && normalizeMcpResource(input.resource) !== row.resource) {
    throw new OAuthInvalidGrantError("resource");
  }

  if (!(await deps.store.claimCode(row.id, now))) throw new OAuthInvalidGrantError("race");

  return issueGrant(deps, {
    userId: row.userId,
    clientId: row.clientId,
    allowWrite: row.allowWrite,
    resource: row.resource,
    authorizationCodeId: row.id,
  });
};

/**
 * refresh_token grant: rotates both tokens. A refresh token that was already rotated out means
 * two parties hold it (OAuth 2.1 §4.3.1): the grant is revoked.
 */
export const refreshGrant = async (
  deps: OAuthDeps,
  input: { refreshToken: string; clientId: string; resource?: string | null },
): Promise<TokenResponse> => {
  const now = deps.now();
  const presented = hashSecret(input.refreshToken);
  const row = await deps.store.findGrantByRefreshHash(presented);
  if (!row) {
    const replayed = await deps.store.findGrantByPreviousRefreshHash(presented);
    if (replayed) {
      await deps.store.revokeGrants({ id: replayed.id }, now, "refresh_reuse");
      throw new OAuthInvalidGrantError("refresh_reuse");
    }
    throw new OAuthInvalidGrantError("not_found");
  }
  if (row.revokedAt) throw new OAuthInvalidGrantError("revoked");
  if (!tokenClientMatchesCode(input.clientId, row.clientId)) throw new OAuthInvalidGrantError("client");
  if (row.refreshExpiresAt.getTime() <= now.getTime()) throw new OAuthInvalidGrantError("expired");
  if (input.resource && normalizeMcpResource(input.resource) !== row.resource) {
    throw new OAuthInvalidGrantError("resource");
  }

  const access = generateAccessToken();
  const refresh = generateRefreshToken();
  const rotated = await deps.store.rotateGrant(row.id, presented, {
    tokenPrefix: access.tokenPrefix,
    tokenHash: access.tokenHash,
    refreshTokenHash: refresh.tokenHash,
    expiresAt: later(now, OAUTH_ACCESS_TOKEN_TTL_MS),
    refreshExpiresAt: later(now, OAUTH_REFRESH_TOKEN_TTL_MS),
  });
  if (!rotated) throw new OAuthInvalidGrantError("race");

  return {
    access_token: access.token,
    token_type: "Bearer",
    expires_in: OAUTH_ACCESS_TOKEN_TTL_MS / 1000,
    refresh_token: refresh.token,
    scope: scopesFor(row.allowWrite).join(" "),
  };
};

/** RFC 7009: revoke by access or refresh token; unknown tokens are not an error. */
export const revokeToken = async (deps: OAuthDeps, token: string) => {
  const now = deps.now();
  if (token.startsWith(OAUTH_ACCESS_TOKEN_PREFIX) && token.length > TOKEN_LOOKUP_LENGTH) {
    const grant = await deps.store.findGrantByTokenPrefix(token.slice(0, TOKEN_LOOKUP_LENGTH));
    if (grant && verifySecret(token, grant.tokenHash)) {
      await deps.store.revokeGrants({ id: grant.id }, now, "client_revoked");
    }
    return;
  }
  const grant = await deps.store.findGrantByRefreshHash(hashSecret(token));
  if (grant) await deps.store.revokeGrants({ id: grant.id }, now, "client_revoked");
};

// --- Personal tokens -------------------------------------------------------------------------

export const createPersonalToken = async (
  deps: OAuthDeps,
  input: { userId: string; name: string; days: number; allowWrite: boolean },
) => {
  const days = Math.min(Math.max(1, Math.floor(input.days)), PERSONAL_TOKEN_MAX_DAYS);
  const now = deps.now();
  const secret = generatePersonalToken();
  const id = createId();
  const expiresAt = later(now, days * 24 * 60 * 60 * 1000);
  await deps.store.createPersonalToken({
    id,
    userId: input.userId,
    name: clampClientName(input.name, "Token personal"),
    tokenPrefix: secret.tokenPrefix,
    tokenHash: secret.tokenHash,
    allowWrite: input.allowWrite,
    expiresAt,
  });
  return { id, token: secret.token, tokenPrefix: secret.tokenPrefix, expiresAt };
};

// --- Resource server -------------------------------------------------------------------------

export type McpConnection = {
  userId: string;
  source: "oauth" | "personal_token";
  /** Grant id or personal token id. */
  connectionId: string;
  clientName: string;
  scopes: McpScope[];
  canWrite: boolean;
  /** When the credential stops working; MCP AuthInfo `expiresAt` is in seconds. */
  expiresAt: Date;
};

/**
 * Who a bearer token acts for, or null. OAuth access tokens must be live, unexpired and issued
 * for this MCP resource (RFC 8707 audience); personal tokens must be live and unexpired.
 */
export const resolveBearer = async (deps: OAuthDeps, token: string): Promise<McpConnection | null> => {
  if (token.length <= TOKEN_LOOKUP_LENGTH) return null;
  const now = deps.now();
  const prefix = token.slice(0, TOKEN_LOOKUP_LENGTH);

  if (token.startsWith(OAUTH_ACCESS_TOKEN_PREFIX)) {
    const grant = await deps.store.findGrantByTokenPrefix(prefix);
    if (!grant || grant.revokedAt || grant.expiresAt.getTime() <= now.getTime()) return null;
    if (!verifySecret(token, grant.tokenHash)) return null;
    if (grant.resource !== getMcpResourceUrl()) return null;
    deps.store.touchGrant(grant.id, now).catch(() => undefined);
    return {
      userId: grant.userId,
      source: "oauth",
      connectionId: grant.id,
      clientName: grant.clientName,
      scopes: scopesFor(grant.allowWrite),
      canWrite: grant.allowWrite,
      expiresAt: grant.expiresAt,
    };
  }

  if (token.startsWith(PERSONAL_TOKEN_PREFIX)) {
    const personal = await deps.store.findPersonalTokenByPrefix(prefix);
    if (!personal || personal.revokedAt || personal.expiresAt.getTime() <= now.getTime()) return null;
    if (!verifySecret(token, personal.tokenHash)) return null;
    deps.store.touchPersonalToken(personal.id, now).catch(() => undefined);
    return {
      userId: personal.userId,
      source: "personal_token",
      connectionId: personal.id,
      clientName: personal.name,
      scopes: scopesFor(personal.allowWrite),
      canWrite: personal.allowWrite,
      expiresAt: personal.expiresAt,
    };
  }

  return null;
};

/**
 * Cuts every agent credential of a user: called when the password changes (with the
 * sessionVersion bump), so a stolen password's connections die with the old sessions.
 */
export const revokeAgentAccessForUser = async (deps: OAuthDeps, userId: string, reason: string) => {
  const now = deps.now();
  const [grants, tokens] = await Promise.all([
    deps.store.revokeGrants({ userId }, now, reason),
    deps.store.revokePersonalTokens({ userId }, now),
  ]);
  return { grants, tokens };
};

export { isOwnMcpResource };
