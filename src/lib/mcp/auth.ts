import type { AuthInfo } from "@modelcontextprotocol/server";
import { getMcpResourceUrl } from "@/lib/mcp-oauth/config";
import { resolveBearer, type OAuthDeps } from "@/lib/mcp-oauth/service";

/**
 * Transport auth for /api/mcp (`withMcpAuth`). The connection resolved here travels in
 * `authInfo.extra` to every tool call, so a call never looks the token up again.
 */
export const verifyMcpBearer =
  (deps: OAuthDeps) =>
  async (_request: Request, bearerToken?: string): Promise<AuthInfo | undefined> => {
    const token = bearerToken?.trim();
    if (!token) return undefined;
    const connection = await resolveBearer(deps, token);
    if (!connection) return undefined;
    return {
      token,
      clientId: `${connection.source}:${connection.connectionId}`,
      scopes: connection.scopes,
      expiresAt: Math.floor(connection.expiresAt.getTime() / 1000),
      resource: new URL(getMcpResourceUrl()),
      extra: { connection },
    };
  };
