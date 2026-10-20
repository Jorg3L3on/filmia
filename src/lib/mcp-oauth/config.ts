/**
 * MCP connector configuration (FIL-I20). Everything public (issuer, resource, metadata URLs)
 * comes from AUTH_URL, never from the Host or X-Forwarded-Host headers: a forged Host must
 * not change what a 401 challenge or the discovery documents advertise.
 */

export type McpScope = "read" | "write";

export const MCP_SCOPES: McpScope[] = ["read", "write"];

export const MCP_RESOURCE_PATH = "/api/mcp";

/** ChatGPT may use origin + /mcp (RFC 9728 path-aware discovery) instead of /api/mcp. */
export const MCP_RESOURCE_ALIAS_PATH = "/mcp";

export const PROTECTED_RESOURCE_METADATA_PATH = "/.well-known/oauth-protected-resource";

export const AUTHORIZATION_SERVER_METADATA_PATH = "/.well-known/oauth-authorization-server";

/** Public guide for the connector; `service_documentation` in the metadata (FIL-I20-7). */
export const MCP_SERVICE_DOCUMENTATION_PATH = "/conector";

export const OAUTH_ACCESS_TOKEN_PREFIX = "filmia_oauth_";
export const OAUTH_REFRESH_TOKEN_PREFIX = "filmia_refresh_";
export const OAUTH_CODE_PREFIX = "filmia_code_";
export const PERSONAL_TOKEN_PREFIX = "filmia_pat_";

/** Characters of a token stored in clear for the lookup; the rest is only in the sha256. */
export const TOKEN_LOOKUP_LENGTH = 20;

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const OAUTH_CODE_TTL_MS = 10 * MINUTE;
export const OAUTH_ACCESS_TOKEN_TTL_MS = DAY;
/** Renewed on every rotation. */
export const OAUTH_REFRESH_TOKEN_TTL_MS = 365 * DAY;

export const PERSONAL_TOKEN_LIFETIMES_DAYS = [7, 30, 90] as const;
export const PERSONAL_TOKEN_MAX_DAYS = 365;

/** CIMD documents are re-fetched when older than this. */
export const CIMD_CACHE_MS = DAY;

export const RETENTION = {
  tokenAttemptsMs: 30 * DAY,
  /** DCR clients that never completed a code exchange. */
  unusedDcrClientMs: 7 * DAY,
  /** Revoked or long-dead grants, kept a while for the activity view. */
  deadGrantsMs: 90 * DAY,
} as const;

/** Only MCP_ENABLED=1 turns the connector on; absent or any other value keeps it 404. */
export const isMcpEnabled = (env: Record<string, string | undefined> = process.env) =>
  env.MCP_ENABLED === "1";

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

/**
 * The canonical public origin. AUTH_URL is set locally and on Vercel; without it (a
 * misconfigured deploy) we fall back to localhost rather than trusting request headers.
 */
export const getIssuer = (env: Record<string, string | undefined> = process.env) => {
  const configured = env.AUTH_URL?.trim();
  if (configured) {
    try {
      return trimTrailingSlash(new URL(configured).origin);
    } catch {
      // fall through
    }
  }
  return "http://localhost:3000";
};

export const issuerUrl = (path: string) => `${getIssuer()}${path}`;

export const getMcpResourceUrl = () => issuerUrl(MCP_RESOURCE_PATH);

const normalizePath = (pathname: string) => pathname.replace(/\/+$/, "") || "/";

/** Canonical MCP resource (always …/api/mcp) for storage and RFC 8707 comparisons. */
export const normalizeMcpResource = (resource: string) => {
  try {
    const url = new URL(resource);
    const issuer = new URL(getIssuer());
    const path = normalizePath(url.pathname);
    if (
      url.origin === issuer.origin &&
      !url.search &&
      !url.hash &&
      (path === MCP_RESOURCE_PATH || path === MCP_RESOURCE_ALIAS_PATH)
    ) {
      return `${issuer.origin}${MCP_RESOURCE_PATH}`;
    }
    return resource;
  } catch {
    return resource;
  }
};

/** Same-origin /mcp and /api/mcp both name this connector. */
export const isOwnMcpResource = (resource: string) =>
  normalizeMcpResource(resource) === getMcpResourceUrl();

/** Scopes a grant or token carries: always read; write only when the person allowed it. */
export const scopesFor = (allowWrite: boolean): McpScope[] =>
  allowWrite ? ["read", "write"] : ["read"];
