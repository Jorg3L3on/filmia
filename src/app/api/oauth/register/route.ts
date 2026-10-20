import { oauthHttpDeps } from "@/lib/mcp-oauth/deps";
import { handleRegister, oauthOptions } from "@/lib/mcp-oauth/http";

export const dynamic = "force-dynamic";

export const POST = (request: Request) => handleRegister(oauthHttpDeps, request);

export const OPTIONS = oauthOptions;
