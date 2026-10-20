import { oauthHttpDeps } from "@/lib/mcp-oauth/deps";
import { handleRevoke, oauthOptions } from "@/lib/mcp-oauth/http";

export const dynamic = "force-dynamic";

export const POST = (request: Request) => handleRevoke(oauthHttpDeps, request);

export const OPTIONS = oauthOptions;
