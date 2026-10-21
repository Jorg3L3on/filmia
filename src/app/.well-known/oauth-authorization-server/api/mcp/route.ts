import { oauthHttpDeps } from "@/lib/mcp-oauth/deps";
import { handleAuthorizationServerMetadata, oauthOptions } from "@/lib/mcp-oauth/http";

export const dynamic = "force-dynamic";

/** RFC 8414; some clients append the resource path to the well-known URL. */
export const GET = () => handleAuthorizationServerMetadata(oauthHttpDeps);

export const OPTIONS = oauthOptions;
