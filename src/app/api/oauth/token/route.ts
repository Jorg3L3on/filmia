import { oauthHttpDeps } from "@/lib/mcp-oauth/deps";
import { handleToken, oauthError, oauthOptions } from "@/lib/mcp-oauth/http";
import { isMcpEnabled } from "@/lib/mcp-oauth/config";

export const dynamic = "force-dynamic";

export const POST = (request: Request) => handleToken(oauthHttpDeps, request);

// Neither writes an attempt row: only POSTs are logged.
export const GET = () =>
  isMcpEnabled() ? oauthError("invalid_request", "Usa POST", 405) : new Response("Not Found", { status: 404 });

export const OPTIONS = oauthOptions;
