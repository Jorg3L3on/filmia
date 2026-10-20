import { oauthHttpDeps } from "@/lib/mcp-oauth/deps";
import { handleConsentPost } from "@/lib/mcp-oauth/http";

export const dynamic = "force-dynamic";

/** Same-origin only (Origin checked in the handler); no CORS. */
export const POST = (request: Request) => handleConsentPost(oauthHttpDeps, request);
