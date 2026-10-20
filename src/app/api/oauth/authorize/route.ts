import { oauthHttpDeps } from "@/lib/mcp-oauth/deps";
import { handleAuthorize, oauthOptions } from "@/lib/mcp-oauth/http";

export const dynamic = "force-dynamic";

export const GET = (request: Request) => handleAuthorize(oauthHttpDeps, request);

export const OPTIONS = oauthOptions;
