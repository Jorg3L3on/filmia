import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { verifyMcpBearer } from "@/lib/mcp/auth";
import type { McpToolDeps } from "@/lib/mcp/define-tool";
import { MCP_INSTRUCTIONS, MCP_SERVER_INFO, registerFilmiaTools } from "@/lib/mcp/server";
import { getIssuer, isMcpEnabled, PROTECTED_RESOURCE_METADATA_PATH } from "@/lib/mcp-oauth/config";
import type { OAuthDeps } from "@/lib/mcp-oauth/service";

/**
 * The /api/mcp endpoint (FIL-I20-2): stateless Streamable HTTP; a 401 challenge whose
 * resource_metadata comes from AUTH_URL, never the Host; CORS limited to the clients that
 * call from a browser.
 */

/** Browser-based MCP clients and the app itself; server-side clients send no Origin. */
export const MCP_ALLOWED_ORIGINS = [
  "https://claude.ai",
  "https://chatgpt.com",
  "https://chat.openai.com",
  "https://grok.com",
] as const;

const isLocalOrigin = (origin: string) => /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(origin);

export const allowedOrigin = (origin: string | null) => {
  if (!origin) return null;
  if (origin === new URL(getIssuer()).origin) return origin;
  if ((MCP_ALLOWED_ORIGINS as readonly string[]).includes(origin)) return origin;
  return isLocalOrigin(origin) ? origin : null;
};

const corsHeaders = (origin: string | null): Record<string, string> => {
  const allowed = allowedOrigin(origin);
  return {
    ...(allowed ? { "Access-Control-Allow-Origin": allowed } : {}),
    Vary: "Origin",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers":
      "Authorization, Content-Type, Accept, mcp-protocol-version, mcp-session-id, last-event-id",
    "Access-Control-Expose-Headers": "mcp-session-id, mcp-protocol-version, WWW-Authenticate",
    "Access-Control-Max-Age": "86400",
  };
};

export type McpEndpointDeps = { oauth: OAuthDeps; tools: McpToolDeps; env?: Record<string, string | undefined> };

export const createMcpEndpoint = (deps: McpEndpointDeps) => {
  const handler = createMcpHandler((server) => registerFilmiaTools(server, deps.tools), {
    serverInfo: MCP_SERVER_INFO,
    instructions: MCP_INSTRUCTIONS,
    capabilities: { tools: { listChanged: false } },
  });

  const handle = async (request: Request) => {
    if (!isMcpEnabled(deps.env ?? process.env)) return new Response("Not Found", { status: 404 });
    const authenticated = withMcpAuth(handler, verifyMcpBearer(deps.oauth), {
      required: true,
      requiredScopes: ["read"],
      resourceMetadataPath: PROTECTED_RESOURCE_METADATA_PATH,
      resourceUrl: getIssuer(),
    });
    const response = await authenticated(request);
    const headers = new Headers(response.headers);
    for (const [key, value] of Object.entries(corsHeaders(request.headers.get("origin")))) {
      if (key === "Vary") headers.append(key, value);
      else headers.set(key, value);
    }
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  };

  const options = (request: Request) =>
    isMcpEnabled(deps.env ?? process.env)
      ? new Response(null, { status: 204, headers: corsHeaders(request.headers.get("origin")) })
      : new Response("Not Found", { status: 404 });

  return { handle, options };
};
