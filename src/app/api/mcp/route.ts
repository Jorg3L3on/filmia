import { createMcpEndpoint } from "@/lib/mcp/http";
import { mcpEndpointDeps } from "@/lib/mcp/deps";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** MCP connector (FIL-I20): Claude, ChatGPT, Grok, Cursor. See docs/mcp-connector.md. */
const endpoint = createMcpEndpoint(mcpEndpointDeps);

export const GET = endpoint.handle;
export const POST = endpoint.handle;
export const DELETE = endpoint.handle;
export const OPTIONS = endpoint.options;
