import { oauthHttpDeps } from "@/lib/mcp-oauth/deps";
import { handleProtectedResourceMetadata, oauthOptions } from "@/lib/mcp-oauth/http";

export const dynamic = "force-dynamic";

/** RFC 9728; the path variants are what clients probe for /api/mcp and /mcp. */
export const GET = () => handleProtectedResourceMetadata(oauthHttpDeps);

export const OPTIONS = oauthOptions;
