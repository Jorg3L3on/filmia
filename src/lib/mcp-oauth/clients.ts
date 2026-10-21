/**
 * Who may register and what the consent screen may trust (FIL-I20-1, decisión 5b952a3f).
 * Pure: no database, no fetch.
 */

/** Hosts whose Client ID Metadata Documents get the «Verificado» badge (ChatGPT). */
export const TRUSTED_CIMD_HOSTS = ["chatgpt.com", "chat.openai.com"] as const;

export const CLIENT_NAME_MAX_LENGTH = 60;

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** Private-use scheme in reverse-DNS form (`com.ejemplo.app:/cb`): two labels or more. */
const PRIVATE_USE_SCHEME = /^[a-z][a-z0-9-]*(\.[a-z0-9-]+)+$/;

const parseUrl = (value: string) => {
  try {
    return new URL(value);
  } catch {
    return null;
  }
};

/**
 * RFC 8252 / OAuth 2.1 §2.3.1 redirect URIs: `https:` on any host, `http:` only on loopback,
 * reverse-DNS private schemes; never a fragment or credentials.
 */
export const isAllowedRedirectUri = (value: string) => {
  const url = parseUrl(value);
  if (!url) return false;
  if (url.hash || value.includes("#")) return false;
  if (url.username || url.password) return false;
  if (url.protocol === "https:") return Boolean(url.hostname);
  if (url.protocol === "http:") return LOOPBACK_HOSTS.has(url.hostname);
  return PRIVATE_USE_SCHEME.test(url.protocol.slice(0, -1).toLowerCase());
};

/** `client_uri` / `logo_uri` end up on the consent screen: https only. */
export const isHttpsUri = (value: string) => {
  const url = parseUrl(value);
  return url?.protocol === "https:" && Boolean(url.hostname) && !url.username && !url.password;
};

export const isTrustedCimdHost = (value: string) => {
  const url = parseUrl(value);
  return Boolean(url && (TRUSTED_CIMD_HOSTS as readonly string[]).includes(url.hostname));
};

/** A CIMD client id is an https URL with a path. */
export const isClientIdMetadataUrl = (clientId: string) => {
  const url = parseUrl(clientId);
  return url?.protocol === "https:" && url.pathname.length > 1 && !url.hash && !url.username;
};

/** Names a DCR client may not take: it would pass for a client we know. */
const IMPERSONATED_NAMES = ["chatgpt", "openai", "claude", "anthropic", "grok", "xai", "cursor"];

export const impersonatesKnownClient = (name: string) => {
  const normalized = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  return IMPERSONATED_NAMES.some((known) => normalized.includes(known));
};

/** One line, trimmed, at most 60 characters (graphemes as code points). */
export const clampClientName = (name: string | null | undefined, fallback: string) => {
  const trimmed = name?.trim().replace(/\s+/g, " ") ?? "";
  if (!trimmed) return fallback;
  const chars = Array.from(trimmed);
  return chars.length > CLIENT_NAME_MAX_LENGTH ? chars.slice(0, CLIENT_NAME_MAX_LENGTH).join("") : trimmed;
};

/** ChatGPT's connector redirect URIs, accepted for trusted CIMD clients whatever the document lists. */
const CHATGPT_REDIRECT_PATTERNS = [
  /^https:\/\/chatgpt\.com\/connector_platform_oauth_redirect\/?$/,
  /^https:\/\/chatgpt\.com\/connector\/oauth\/[^/?#]+$/,
  /^https:\/\/chat\.openai\.com\/connector_platform_oauth_redirect\/?$/,
  /^https:\/\/chat\.openai\.com\/connector\/oauth\/[^/?#]+$/,
];

export const isRedirectUriAllowedFor = (
  client: { id: string; redirectUris: string[] },
  redirectUri: string,
) =>
  client.redirectUris.includes(redirectUri) ||
  (isTrustedCimdHost(client.id) && CHATGPT_REDIRECT_PATTERNS.some((pattern) => pattern.test(redirectUri)));

/**
 * The token request's client_id must be the code's. The one exception is ChatGPT's stable vs
 * per-instance CIMD, both on a trusted OpenAI host.
 */
export const tokenClientMatchesCode = (tokenClientId: string, codeClientId: string) =>
  tokenClientId === codeClientId ||
  (isClientIdMetadataUrl(tokenClientId) &&
    isClientIdMetadataUrl(codeClientId) &&
    isTrustedCimdHost(tokenClientId) &&
    isTrustedCimdHost(codeClientId));

/** A CIMD fetched from one URL may declare another only between trusted OpenAI hosts. */
export const cimdClientIdsMatch = (fetchUrl: string, documentClientId: string) =>
  fetchUrl === documentClientId ||
  (isClientIdMetadataUrl(fetchUrl) &&
    isClientIdMetadataUrl(documentClientId) &&
    isTrustedCimdHost(fetchUrl) &&
    isTrustedCimdHost(documentClientId));

/** What the consent screen says about the client. */
export type ClientTrust = { verified: boolean; redirectHost: string };

export const clientTrust = (client: { id: string; isCimd: boolean }, redirectUri: string): ClientTrust => {
  const verified = client.isCimd && isTrustedCimdHost(client.id);
  const url = parseUrl(redirectUri);
  const redirectHost = url ? (url.host || `${url.protocol}`) : redirectUri;
  return { verified, redirectHost };
};

export type ClientIdKind = "cimd_trusted" | "cimd_other" | "dcr" | "other";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** For the token-attempt log: what kind of client id came, never the id itself. */
export const classifyClientId = (clientId: unknown): ClientIdKind => {
  if (typeof clientId !== "string" || !clientId.trim()) return "other";
  if (isClientIdMetadataUrl(clientId)) return isTrustedCimdHost(clientId) ? "cimd_trusted" : "cimd_other";
  return UUID.test(clientId) ? "dcr" : "other";
};
