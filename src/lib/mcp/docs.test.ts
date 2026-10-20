import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import { CLIENT_GUIDES } from "./client-guides";
import { MCP_ERROR_CODES } from "./errors";
import { mcpToolDefinitions } from "./server";

/** The connector's docs stay in sync with the code (FIL-I20-7). */
describe("connector docs", () => {
  const sources = Promise.all([
    readFile(new URL("../../../docs/mcp-connector.md", import.meta.url), "utf8"),
    readFile(new URL("../../app/conector/page.tsx", import.meta.url), "utf8"),
  ]);

  it("docs/mcp-connector.md lists every tool, error code, client, limit and lifetime", async () => {
    const [markdown] = await sources;
    for (const tool of mcpToolDefinitions()) assert.match(markdown, new RegExp(`\`${tool.name}\``), tool.name);
    for (const code of MCP_ERROR_CODES) assert.ok(markdown.includes(`\`${code}\``), code);
    for (const client of ["Claude", "ChatGPT", "Grok", "Cursor"]) assert.ok(markdown.includes(client), client);
    for (const fact of ["24 h", "365 días", "30 por minuto", "10 por hora", "120 por minuto", "MCP_ENABLED"]) {
      assert.ok(markdown.includes(fact), fact);
    }
  });

  it("the public guide renders the tools, errors and the four client guides from code", async () => {
    const [, page] = await sources;
    assert.match(page, /mcpToolDefinitions\(\)/);
    assert.match(page, /MCP_ERROR_CODES\.map/);
    assert.match(page, /CLIENT_GUIDES\.map/);
    assert.match(page, /24 h/);
    assert.match(page, /365 días/);
    assert.deepEqual(CLIENT_GUIDES.map((guide) => guide.id), ["claude", "chatgpt", "grok", "cursor"]);
  });
});
