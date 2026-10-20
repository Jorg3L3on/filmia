import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  TEST_ISSUER,
  formRequest,
  jsonRequest,
  oauthTestbed,
  pkcePair,
} from "@/lib/test-support/oauth";
import { getIssuer, getMcpResourceUrl, OAUTH_ACCESS_TOKEN_TTL_MS, OAUTH_REFRESH_TOKEN_TTL_MS } from "./config";
import { fetchJsonDocument, isFetchableDocumentUrl } from "./fetch-document";
import {
  handleAuthorizationServerMetadata,
  handleAuthorize,
  handleConsentPost,
  handleProtectedResourceMetadata,
  handleRegister,
  handleRevoke,
  handleToken,
} from "./http";
import { createPersonalToken, resolveBearer, revokeAgentAccessForUser } from "./service";

const REDIRECT = "https://client.example/callback";
const SAME_ORIGIN = { origin: TEST_ISSUER };

type Testbed = ReturnType<typeof oauthTestbed>;

const register = async (bed: Testbed, body: Record<string, unknown> = {}) => {
  const response = await handleRegister(
    bed.deps,
    jsonRequest("/api/oauth/register", { client_name: "Agente de prueba", redirect_uris: [REDIRECT], ...body }),
  );
  return { response, json: (await response.json()) as Record<string, unknown> };
};

const consent = async (
  bed: Testbed,
  clientId: string,
  challenge: string,
  extra: Record<string, unknown> = {},
  headers: Record<string, string> = SAME_ORIGIN,
) =>
  handleConsentPost(
    bed.deps,
    jsonRequest(
      "/api/oauth/consent",
      {
        client_id: clientId,
        redirect_uri: REDIRECT,
        state: "st",
        code_challenge: challenge,
        code_challenge_method: "S256",
        decision: "allow",
        ...extra,
      },
      headers,
    ),
  );

const codeFrom = async (response: Response) => {
  const { redirect_to } = (await response.json()) as { redirect_to: string };
  return new URL(redirect_to).searchParams.get("code")!;
};

const token = (bed: Testbed, fields: Record<string, string>, ip = "10.0.0.1") =>
  handleToken(bed.deps, formRequest("/api/oauth/token", fields, { "x-forwarded-for": ip }));

/** Register → consent → code. */
const authorize = async (bed: Testbed, consentExtra: Record<string, unknown> = {}) => {
  const { json } = await register(bed);
  const clientId = json.client_id as string;
  const pkce = pkcePair();
  const code = await codeFrom(await consent(bed, clientId, pkce.challenge, consentExtra));
  return { clientId, pkce, code };
};

const exchange = async (bed: Testbed, flow: Awaited<ReturnType<typeof authorize>>, extra: Record<string, string> = {}) =>
  token(bed, {
    grant_type: "authorization_code",
    code: flow.code,
    client_id: flow.clientId,
    redirect_uri: REDIRECT,
    code_verifier: flow.pkce.verifier,
    ...extra,
  });

const tokens = async (response: Response) =>
  (await response.json()) as { access_token: string; refresh_token: string; scope: string; error?: string };

describe("OAuth server: PKCE and the code exchange (FIL-I20-1)", () => {
  it("rejects an exchange with a client_assertion and no code_verifier", async () => {
    const bed = oauthTestbed();
    const flow = await authorize(bed);
    const response = await token(bed, {
      grant_type: "authorization_code",
      code: flow.code,
      client_id: flow.clientId,
      redirect_uri: REDIRECT,
      client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
      client_assertion: "eyJhbGciOiJSUzI1NiJ9.eyJpc3MiOiJ4In0.c2ln",
    });
    assert.equal(response.status, 400);
    assert.equal((await tokens(response)).error, "invalid_grant");
    // The code was not burnt: the right verifier still works.
    assert.equal((await exchange(bed, flow)).status, 200);
  });

  it("rejects a wrong verifier and a client_id other than the code's", async () => {
    const bed = oauthTestbed();
    const flow = await authorize(bed);
    const wrong = await exchange(bed, flow, { code_verifier: pkcePair().verifier });
    assert.equal((await tokens(wrong)).error, "invalid_grant");

    const other = (await register(bed, { redirect_uris: [REDIRECT] })).json.client_id as string;
    const mismatch = await exchange(bed, flow, { client_id: other });
    assert.equal(mismatch.status, 400);
    assert.equal((await tokens(mismatch)).error, "invalid_grant");
  });

  it("issues one grant for two concurrent exchanges of the same code", async () => {
    const bed = oauthTestbed();
    const flow = await authorize(bed);
    const [first, second] = await Promise.all([exchange(bed, flow), exchange(bed, flow)]);
    assert.deepEqual([first.status, second.status].sort(), [200, 400]);
    assert.equal(bed.rows.grants.size, 1);
  });

  it("revokes the grant a code issued when the code is presented again", async () => {
    const bed = oauthTestbed();
    const flow = await authorize(bed);
    const issued = await tokens(await exchange(bed, flow));
    assert.ok(await resolveBearer(bed.deps.oauth, issued.access_token));

    const replay = await exchange(bed, flow);
    assert.equal((await tokens(replay)).error, "invalid_grant");
    assert.equal([...bed.rows.grants.values()][0]!.revokedReason, "code_reuse");
    assert.equal(await resolveBearer(bed.deps.oauth, issued.access_token), null);
  });
});

describe("OAuth server: audience (RFC 8707)", () => {
  it("does not accept a token whose grant was issued for another resource", async () => {
    const bed = oauthTestbed();
    const flow = await authorize(bed);
    const issued = await tokens(await exchange(bed, flow));
    const grant = [...bed.rows.grants.values()][0]!;
    grant.resource = "https://otro.example/api/mcp";
    assert.equal(await resolveBearer(bed.deps.oauth, issued.access_token), null);
    grant.resource = getMcpResourceUrl();
    assert.ok(await resolveBearer(bed.deps.oauth, issued.access_token));
  });

  it("answers invalid_target from /authorize and from the consent POST for a foreign resource", async () => {
    const bed = oauthTestbed();
    const { json } = await register(bed);
    const pkce = pkcePair();
    const params = new URLSearchParams({
      response_type: "code",
      client_id: json.client_id as string,
      redirect_uri: REDIRECT,
      code_challenge: pkce.challenge,
      code_challenge_method: "S256",
      state: "abc",
      resource: "https://otro.example/mcp",
    });
    const authorizeResponse = await handleAuthorize(
      bed.deps,
      new Request(`${TEST_ISSUER}/api/oauth/authorize?${params}`),
    );
    assert.equal(authorizeResponse.status, 302);
    const back = new URL(authorizeResponse.headers.get("location")!);
    assert.equal(back.origin + back.pathname, REDIRECT);
    assert.equal(back.searchParams.get("error"), "invalid_target");
    assert.equal(back.searchParams.get("state"), "abc");

    const consentResponse = await consent(bed, json.client_id as string, pkce.challenge, {
      resource: "https://otro.example/api/mcp",
    });
    assert.equal(consentResponse.status, 400);
    assert.equal(((await consentResponse.json()) as { error: string }).error, "invalid_target");
  });

  it("treats /mcp and /api/mcp on the issuer as the same resource", async () => {
    const bed = oauthTestbed();
    const flow = await authorize(bed, { resource: `${TEST_ISSUER}/mcp` });
    const response = await exchange(bed, flow, { resource: `${TEST_ISSUER}/api/mcp` });
    assert.equal(response.status, 200);
    assert.equal([...bed.rows.grants.values()][0]!.resource, `${TEST_ISSUER}/api/mcp`);
  });

  it("sends a valid request to the consent page on the issuer, not the request host", async () => {
    const bed = oauthTestbed();
    const { json } = await register(bed);
    const params = new URLSearchParams({
      response_type: "code",
      client_id: json.client_id as string,
      redirect_uri: REDIRECT,
      code_challenge: pkcePair().challenge,
      code_challenge_method: "S256",
    });
    const response = await handleAuthorize(
      bed.deps,
      new Request(`http://evil.example/api/oauth/authorize?${params}`, { headers: { host: "evil.example" } }),
    );
    const location = new URL(response.headers.get("location")!);
    assert.equal(location.origin, TEST_ISSUER);
    assert.equal(location.pathname, "/oauth/consent");
    assert.equal(location.searchParams.get("resource"), `${TEST_ISSUER}/api/mcp`);
  });
});

describe("OAuth server: lifetimes and refresh", () => {
  it("expires access tokens after 24 h and refresh tokens after 365 d", async () => {
    const bed = oauthTestbed();
    const flow = await authorize(bed);
    const issued = await tokens(await exchange(bed, flow));
    bed.clock.advance(OAUTH_ACCESS_TOKEN_TTL_MS - 1000);
    assert.ok(await resolveBearer(bed.deps.oauth, issued.access_token));
    bed.clock.advance(2000);
    assert.equal(await resolveBearer(bed.deps.oauth, issued.access_token), null);

    // Refresh still works after the access token died, and rotates both.
    const refreshed = await token(bed, {
      grant_type: "refresh_token",
      refresh_token: issued.refresh_token,
      client_id: flow.clientId,
    });
    const next = await tokens(refreshed);
    assert.equal(refreshed.status, 200);
    assert.notEqual(next.refresh_token, issued.refresh_token);
    assert.ok(await resolveBearer(bed.deps.oauth, next.access_token));

    bed.clock.advance(OAUTH_REFRESH_TOKEN_TTL_MS + 1000);
    const expired = await token(bed, {
      grant_type: "refresh_token",
      refresh_token: next.refresh_token,
      client_id: flow.clientId,
    });
    assert.equal((await tokens(expired)).error, "invalid_grant");
  });

  it("revokes the grant when a rotated refresh token is used again", async () => {
    const bed = oauthTestbed();
    const flow = await authorize(bed);
    const issued = await tokens(await exchange(bed, flow));
    const rotated = await tokens(
      await token(bed, { grant_type: "refresh_token", refresh_token: issued.refresh_token, client_id: flow.clientId }),
    );
    const replay = await token(bed, {
      grant_type: "refresh_token",
      refresh_token: issued.refresh_token,
      client_id: flow.clientId,
    });
    assert.equal((await tokens(replay)).error, "invalid_grant");
    assert.equal([...bed.rows.grants.values()][0]!.revokedReason, "refresh_reuse");
    assert.equal(await resolveBearer(bed.deps.oauth, rotated.access_token), null);
    const afterRevoke = await token(bed, {
      grant_type: "refresh_token",
      refresh_token: rotated.refresh_token,
      client_id: flow.clientId,
    });
    assert.equal((await tokens(afterRevoke)).error, "invalid_grant");
  });

  it("revokes by access or refresh token at /revoke", async () => {
    const bed = oauthTestbed();
    const issued = await tokens(await exchange(bed, await authorize(bed)));
    const response = await handleRevoke(bed.deps, formRequest("/api/oauth/revoke", { token: issued.refresh_token }));
    assert.equal(response.status, 200);
    assert.equal(await resolveBearer(bed.deps.oauth, issued.access_token), null);
  });
});

describe("OAuth server: dynamic client registration", () => {
  for (const uri of ["javascript:alert(1)", "data:text/html,hola", "http://evil.example/cb", "https://a.example/cb#frag"]) {
    it(`rejects redirect_uri ${uri}`, async () => {
      const { response, json } = await register(oauthTestbed(), { redirect_uris: [uri] });
      assert.equal(response.status, 400);
      assert.equal(json.error, "invalid_redirect_uri");
    });
  }

  for (const uri of ["http://127.0.0.1:33418/cb", "http://localhost:6274/oauth/callback", "http://[::1]:8080/cb", "https://claude.ai/api/mcp/auth_callback", "com.cursor.app:/oauth"]) {
    it(`accepts redirect_uri ${uri}`, async () => {
      const { response, json } = await register(oauthTestbed(), { redirect_uris: [uri] });
      assert.equal(response.status, 201, JSON.stringify(json));
      assert.deepEqual(json.redirect_uris, [uri]);
    });
  }

  it("rejects an http client_uri or logo_uri", async () => {
    const bed = oauthTestbed();
    for (const field of ["client_uri", "logo_uri"]) {
      const { response, json } = await register(bed, { [field]: "http://client.example" });
      assert.equal(response.status, 400);
      assert.equal(json.error, "invalid_client_metadata");
    }
  });

  it("rejects names that pass for known clients and clamps long names to 60", async () => {
    const bed = oauthTestbed();
    for (const name of ["Claude", "ChatGPT connector", "Cursor-IDE", "x.AI Grok"]) {
      const { json } = await register(bed, { client_name: name });
      assert.equal(json.error, "invalid_client_metadata", name);
    }
    const { json } = await register(bed, { client_name: `Mi agente ${"x".repeat(100)}` });
    assert.equal(Array.from(json.client_name as string).length, 60);
  });

  it("returns a secret only for client_secret_post, and checks it at /token", async () => {
    const bed = oauthTestbed();
    const { json } = await register(bed, { token_endpoint_auth_method: "client_secret_post" });
    assert.equal(typeof json.client_secret, "string");
    const pkce = pkcePair();
    const code = await codeFrom(await consent(bed, json.client_id as string, pkce.challenge));
    const fields = {
      grant_type: "authorization_code",
      code,
      client_id: json.client_id as string,
      redirect_uri: REDIRECT,
      code_verifier: pkce.verifier,
    };
    const noSecret = await token(bed, fields);
    assert.equal(noSecret.status, 401);
    assert.equal(noSecret.headers.get("www-authenticate"), 'Basic realm="oauth"');
    assert.equal((await token(bed, { ...fields, client_secret: json.client_secret as string })).status, 200);
  });
});

describe("OAuth server: rate limits", () => {
  it("answers 429 with Retry-After past 30 token requests a minute from one IP", async () => {
    const bed = oauthTestbed();
    for (let i = 0; i < 30; i += 1) {
      assert.notEqual((await token(bed, { grant_type: "refresh_token", client_id: "x", refresh_token: "y" })).status, 429);
    }
    const limited = await token(bed, { grant_type: "refresh_token", client_id: "x", refresh_token: "y" });
    assert.equal(limited.status, 429);
    assert.ok(Number(limited.headers.get("retry-after")) > 0);
    assert.equal(bed.rows.tokenAttempts.length, 30, "the limited request writes no attempt row");
    // Another IP is not affected.
    assert.notEqual((await token(bed, { grant_type: "x" }, "10.0.0.2")).status, 429);
  });

  it("answers 429 past 10 registrations an hour from one IP", async () => {
    const bed = oauthTestbed();
    const post = () =>
      handleRegister(
        bed.deps,
        jsonRequest("/api/oauth/register", { redirect_uris: [REDIRECT] }, { "x-forwarded-for": "10.9.9.9" }),
      );
    for (let i = 0; i < 10; i += 1) assert.equal((await post()).status, 201);
    const limited = await post();
    assert.equal(limited.status, 429);
    assert.ok(limited.headers.get("retry-after"));
  });

  it("writes one attempt row per token POST and none for GET or OPTIONS", async () => {
    const bed = oauthTestbed();
    const { GET, OPTIONS } = await import("@/app/api/oauth/token/route");
    process.env.MCP_ENABLED = "1";
    assert.equal(GET().status, 405);
    assert.equal(OPTIONS().status, 204);
    delete process.env.MCP_ENABLED;
    assert.equal(bed.rows.tokenAttempts.length, 0);
    await token(bed, { grant_type: "authorization_code", client_id: "nobody", code: "c", redirect_uri: REDIRECT });
    assert.equal(bed.rows.tokenAttempts.length, 1);
    const [attempt] = bed.rows.tokenAttempts;
    assert.equal(attempt!.error, "invalid_client");
    assert.equal(JSON.stringify(attempt).includes("nobody"), false, "no client id in the log");
  });
});

describe("OAuth server: CIMD fetches", () => {
  it("refuses IP literals, localhost and private names before fetching", async () => {
    for (const url of [
      "https://127.0.0.1/client.json",
      "https://[::1]/client.json",
      "https://10.0.0.8/client.json",
      "https://2130706433/client.json",
      "https://localhost/client.json",
      "https://intranet.local/client.json",
      "https://db.internal/client.json",
      "http://client.example/client.json",
      "https://client.example:8443/client.json",
    ]) {
      assert.equal(isFetchableDocumentUrl(url), false, url);
      let called = false;
      const result = await fetchJsonDocument(url, {
        fetchImpl: async () => {
          called = true;
          return new Response("{}");
        },
      });
      assert.deepEqual(result, { ok: false, reason: "url" });
      assert.equal(called, false, url);
    }
    assert.equal(isFetchableDocumentUrl("https://chatgpt.com/oauth/client.json"), true);
  });

  it("refuses bodies over 64 KiB, declared or streamed", async () => {
    const big = JSON.stringify({ pad: "x".repeat(70 * 1024) });
    const declared = await fetchJsonDocument("https://client.example/c.json", {
      fetchImpl: async () => new Response(big, { headers: { "content-length": String(big.length) } }),
    });
    assert.deepEqual(declared, { ok: false, reason: "too_large" });
    const streamed = await fetchJsonDocument("https://client.example/c.json", {
      fetchImpl: async () =>
        new Response(
          new ReadableStream({
            start(controller) {
              for (let i = 0; i < 80; i += 1) controller.enqueue(new TextEncoder().encode("x".repeat(1024)));
              controller.close();
            },
          }),
        ),
    });
    assert.deepEqual(streamed, { ok: false, reason: "too_large" });
  });

  it("follows one same-host redirect only", async () => {
    const hop = (location: string) => new Response(null, { status: 302, headers: { location } });
    const offHost = await fetchJsonDocument("https://client.example/c.json", {
      fetchImpl: async () => hop("https://127.0.0.1/c.json"),
    });
    assert.deepEqual(offHost, { ok: false, reason: "redirect" });
    let calls = 0;
    const sameHost = await fetchJsonDocument("https://client.example/c.json", {
      fetchImpl: async () => (calls++ === 0 ? hop("/v2/c.json") : Response.json({ ok: 1 })),
    });
    assert.deepEqual(sameHost, { ok: true, json: { ok: 1 } });
  });

  it("resolves a CIMD client once, caches it 24 h and marks only OpenAI hosts verified", async () => {
    const bed = oauthTestbed();
    const clientId = "https://chatgpt.com/oauth/client.json";
    bed.documents.set(clientId, {
      client_id: clientId,
      client_name: "ChatGPT",
      redirect_uris: ["https://chatgpt.com/connector_platform_oauth_redirect"],
      token_endpoint_auth_method: "private_key_jwt",
    });
    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: "https://chatgpt.com/connector_platform_oauth_redirect",
      code_challenge: pkcePair().challenge,
      code_challenge_method: "S256",
    });
    const authorizeOnce = () => handleAuthorize(bed.deps, new Request(`${TEST_ISSUER}/api/oauth/authorize?${params}`));
    assert.equal((await authorizeOnce()).status, 302);
    assert.equal((await authorizeOnce()).status, 302);
    assert.equal(bed.fetchCalls.length, 1);
    const client = bed.rows.clients.get(clientId)!;
    assert.equal(client.isCimd, true);
    assert.equal(client.tokenEndpointAuthMethod, "none", "private_key_jwt is treated as public PKCE");
    bed.clock.advance(25 * 60 * 60 * 1000);
    await authorizeOnce();
    assert.equal(bed.fetchCalls.length, 2);
  });
});

describe("OAuth server: consent", () => {
  it("rejects a consent POST from another origin", async () => {
    const bed = oauthTestbed();
    const { json } = await register(bed);
    const cross = await consent(bed, json.client_id as string, pkcePair().challenge, {}, { origin: "https://evil.example" });
    assert.equal(cross.status, 403);
    const noOrigin = await consent(bed, json.client_id as string, pkcePair().challenge, {}, {});
    assert.equal(noOrigin.status, 403);
    const fetchSite = await consent(bed, json.client_id as string, pkcePair().challenge, {}, { "sec-fetch-site": "same-origin" });
    assert.equal(fetchSite.status, 200);
    assert.equal(bed.rows.codes.size, 1);
  });

  it("needs a live Filmia session", async () => {
    const bed = oauthTestbed({ userId: null });
    const { json } = await register(bed);
    assert.equal((await consent(bed, json.client_id as string, pkcePair().challenge)).status, 401);
  });

  it("grants write only when allow_write is exactly true", async () => {
    const bed = oauthTestbed();
    for (const [allow, expected] of [[undefined, "read"], ["true", "read"], [false, "read"], [true, "read write"]] as const) {
      const flow = await authorize(bed, allow === undefined ? {} : { allow_write: allow });
      const issued = await tokens(await exchange(bed, flow));
      assert.equal(issued.scope, expected, `allow_write=${String(allow)}`);
      const connection = await resolveBearer(bed.deps.oauth, issued.access_token);
      assert.equal(connection?.canWrite, expected === "read write");
    }
  });

  it("answers access_denied with the state when the person cancels", async () => {
    const bed = oauthTestbed();
    const { json } = await register(bed);
    const response = await consent(bed, json.client_id as string, pkcePair().challenge, { decision: "deny" });
    const back = new URL(((await response.json()) as { redirect_to: string }).redirect_to);
    assert.equal(back.searchParams.get("error"), "access_denied");
    assert.equal(back.searchParams.get("state"), "st");
    assert.equal(back.searchParams.get("iss"), TEST_ISSUER);
    assert.equal(bed.rows.codes.size, 0);
  });

  it("never sends a code to a redirect_uri the client did not register", async () => {
    const bed = oauthTestbed();
    const { json } = await register(bed);
    const response = await consent(bed, json.client_id as string, pkcePair().challenge, {
      redirect_uri: "https://evil.example/cb",
    });
    assert.equal(response.status, 400);
    assert.equal(bed.rows.codes.size, 0);
  });
});

describe("OAuth server: revocation when the password changes", () => {
  it("revokes every grant and personal token of the user, and only theirs", async () => {
    const bed = oauthTestbed();
    const issued = await tokens(await exchange(bed, await authorize(bed)));
    const personal = await createPersonalToken(bed.deps.oauth, { userId: "user-ana", name: "Cursor", days: 30, allowWrite: false });
    bed.signIn("user-leo");
    const leo = await tokens(await exchange(bed, await authorize(bed)));
    const leoPersonal = await createPersonalToken(bed.deps.oauth, { userId: "user-leo", name: "Cursor", days: 7, allowWrite: true });

    const revoked = await revokeAgentAccessForUser(bed.deps.oauth, "user-ana", "password_changed");
    assert.deepEqual(revoked, { grants: 1, tokens: 1 });
    assert.equal(await resolveBearer(bed.deps.oauth, issued.access_token), null);
    assert.equal(await resolveBearer(bed.deps.oauth, personal.token), null);
    assert.ok(await resolveBearer(bed.deps.oauth, leo.access_token));
    assert.ok(await resolveBearer(bed.deps.oauth, leoPersonal.token));
  });

  it("is called from the password change action", async () => {
    const { readFile } = await import("node:fs/promises");
    const source = await readFile(new URL("../../app/actions/profile.ts", import.meta.url), "utf8");
    const change = source.slice(source.indexOf("sessionVersion: sql`"));
    assert.match(change, /revokeAgentAccessForUser\(oauthDeps, userId, "password_changed"\)/);
  });
});

describe("Personal tokens", () => {
  it("stores only the prefix and a sha256, and expires", async () => {
    const bed = oauthTestbed();
    const created = await createPersonalToken(bed.deps.oauth, { userId: "user-ana", name: "Cursor", days: 7, allowWrite: false });
    const row = [...bed.rows.personalTokens.values()][0]!;
    assert.equal(row.tokenPrefix, created.token.slice(0, 20));
    assert.match(row.tokenHash, /^sha256:[0-9a-f]{64}$/);
    assert.equal(JSON.stringify(row).includes(created.token), false);
    const connection = await resolveBearer(bed.deps.oauth, created.token);
    assert.deepEqual(connection?.scopes, ["read"]);
    bed.clock.advance(7 * 24 * 60 * 60 * 1000 + 1);
    assert.equal(await resolveBearer(bed.deps.oauth, created.token), null);
  });

  it("caps the lifetime at 365 days", async () => {
    const bed = oauthTestbed();
    const created = await createPersonalToken(bed.deps.oauth, { userId: "u", name: "x", days: 5000, allowWrite: false });
    assert.equal(created.expiresAt.getTime() - bed.clock.now().getTime(), 365 * 24 * 60 * 60 * 1000);
  });
});

describe("MCP_ENABLED and the public origin", () => {
  it("answers 404 on every OAuth and discovery route unless MCP_ENABLED is exactly 1", async () => {
    for (const value of [undefined, "0", "true", "yes", " 1"]) {
      const bed = oauthTestbed();
      bed.deps.env = { MCP_ENABLED: value };
      const responses = [
        handleProtectedResourceMetadata(bed.deps),
        handleAuthorizationServerMetadata(bed.deps),
        await handleAuthorize(bed.deps, new Request(`${TEST_ISSUER}/api/oauth/authorize`)),
        await handleToken(bed.deps, formRequest("/api/oauth/token", {})),
        await handleRegister(bed.deps, jsonRequest("/api/oauth/register", {})),
        await handleRevoke(bed.deps, formRequest("/api/oauth/revoke", {})),
        await handleConsentPost(bed.deps, jsonRequest("/api/oauth/consent", {}, SAME_ORIGIN)),
      ];
      assert.deepEqual(responses.map((response) => response.status), [404, 404, 404, 404, 404, 404, 404], String(value));
    }
    const on = oauthTestbed();
    assert.equal(handleProtectedResourceMetadata(on.deps).status, 200);
    assert.equal(handleAuthorizationServerMetadata(on.deps).status, 200);
  });

  it("builds the issuer and resource_metadata from AUTH_URL whatever the Host says", async () => {
    const bed = oauthTestbed();
    assert.equal(getIssuer(), TEST_ISSUER);
    const resource = (await handleProtectedResourceMetadata(bed.deps).json()) as Record<string, unknown>;
    assert.equal(resource.resource, `${TEST_ISSUER}/api/mcp`);
    assert.deepEqual(resource.authorization_servers, [TEST_ISSUER]);
    const server = (await handleAuthorizationServerMetadata(bed.deps).json()) as Record<string, unknown>;
    assert.equal(server.issuer, TEST_ISSUER);
    assert.equal(server.token_endpoint, `${TEST_ISSUER}/api/oauth/token`);
    assert.deepEqual(server.token_endpoint_auth_methods_supported, ["none", "client_secret_post"]);
    assert.deepEqual(server.code_challenge_methods_supported, ["S256"]);
    assert.equal(server.service_documentation, `${TEST_ISSUER}/conector`);
  });

  it("documents MCP_ENABLED in .env.example", async () => {
    const { readFile } = await import("node:fs/promises");
    const example = await readFile(new URL("../../../.env.example", import.meta.url), "utf8");
    assert.match(example, /^MCP_ENABLED=/m);
  });
});
