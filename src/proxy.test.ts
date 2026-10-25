import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PUBLIC_PATHS, isPublicPath, proxy } from "./proxy";

/**
 * The list of routes the proxy lets through without a session. A new entry must be added here
 * on purpose: each one has to authenticate by itself (FIL-I20-1).
 */
const EXPECTED_PUBLIC_PATHS = [
  "/login",
  "/registro",
  "/api/auth",
  "/api/cron",
  "/compartir",
  "/unirse",
  "/api/mcp",
  "/mcp",
  "/api/oauth",
  "/.well-known",
  "/conector",
];

const request = (path: string) => new Request(`https://filmia.test${path}`, { headers: { host: "filmia.test" } });

describe("proxy public paths", () => {
  it("lets through exactly the expected public prefixes", () => {
    assert.deepEqual([...PUBLIC_PATHS].sort(), [...EXPECTED_PUBLIC_PATHS].sort());
  });

  it("serves the MCP connector routes without a session", async () => {
    for (const path of [
      "/api/mcp",
      "/mcp",
      "/api/oauth/token",
      "/api/oauth/authorize?client_id=x",
      "/api/oauth/consent",
      "/.well-known/oauth-protected-resource",
      "/.well-known/oauth-protected-resource/mcp",
      "/.well-known/oauth-authorization-server",
      "/conector",
    ]) {
      const response = await proxy(request(path));
      assert.equal(response.headers.get("location"), null, path);
      assert.equal(response.headers.get("x-middleware-next"), "1", path);
    }
  });

  it("sends a signed-out visitor of the consent page to the login and back", async () => {
    const response = await proxy(request("/oauth/consent?client_id=abc&state=1"));
    const location = new URL(response.headers.get("location")!);
    assert.equal(location.pathname, "/login");
    assert.equal(location.searchParams.get("callbackUrl"), "/oauth/consent?client_id=abc&state=1");
  });

  it("does not treat lookalike paths as public", () => {
    for (const path of ["/mcpx", "/api/mcp-admin", "/api/oauthx", "/oauth/consent", "/well-known"]) {
      assert.equal(isPublicPath(path), false, path);
    }
  });

  it("keeps the toast bench off the public list outside development", () => {
    assert.equal(PUBLIC_PATHS.includes("/alertas-sala"), false);
    if (process.env.NODE_ENV !== "development") {
      assert.equal(isPublicPath("/alertas-sala"), false);
    }
  });

  it("keeps /.well-known inside the proxy matcher", async () => {
    const { config } = await import("./proxy");
    const matcher = new RegExp(`^${config.matcher[0]!.replace("/((?!", "/(?!").replace(").*)", ").*")}$`);
    assert.equal(matcher.test("/.well-known/oauth-authorization-server"), true);
  });
});
