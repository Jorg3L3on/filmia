import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildGoogleAuthorizationUrl,
  decodeOAuthState,
  encodeOAuthState,
  googleRedirectUri,
  googleSignInHref,
  parseGoogleIdTokenClaims,
  pkceChallenge,
  randomToken,
  safeNextPath,
} from "./google-oauth";

describe("google oauth helpers", () => {
  it("derives the RFC 7636 S256 challenge", async () => {
    // Test vector from RFC 7636 appendix B.
    const challenge = await pkceChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk");
    assert.equal(challenge, "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });

  it("generates url-safe random tokens", () => {
    const token = randomToken();
    assert.match(token, /^[A-Za-z0-9_-]+$/);
    assert.notEqual(token, randomToken());
  });

  it("only allows same-origin app paths as the post-login target", () => {
    assert.equal(safeNextPath(null), "/");
    assert.equal(safeNextPath(""), "/");
    assert.equal(safeNextPath("/watchlist"), "/watchlist");
    assert.equal(safeNextPath("/titulos/abc?tab=notas"), "/titulos/abc?tab=notas");
    assert.equal(safeNextPath("https://evil.example"), "/");
    assert.equal(safeNextPath("//evil.example"), "/");
    assert.equal(safeNextPath("/\\evil.example"), "/");
    assert.equal(safeNextPath("/login"), "/");
    assert.equal(safeNextPath("/login?error=x"), "/");
    assert.equal(safeNextPath("/registro"), "/");
    assert.equal(safeNextPath("/api/auth/google"), "/");
    assert.equal(safeNextPath("/loginpage"), "/loginpage");
  });

  it("builds the start href with an optional next", () => {
    assert.equal(googleSignInHref(null), "/api/auth/google");
    assert.equal(googleSignInHref("/"), "/api/auth/google");
    assert.equal(googleSignInHref("/listas"), "/api/auth/google?next=%2Flistas");
    assert.equal(googleSignInHref("https://evil.example"), "/api/auth/google");
  });

  it("points the redirect uri at the callback route", () => {
    assert.equal(
      googleRedirectUri("http://localhost:3000/"),
      "http://localhost:3000/api/auth/google/callback",
    );
  });

  it("builds a PKCE authorization url", () => {
    const href = buildGoogleAuthorizationUrl({
      clientId: "client-id",
      redirectUri: "http://localhost:3000/api/auth/google/callback",
      state: "state-123",
      codeChallenge: "challenge",
    });
    const url = new URL(href);
    assert.equal(url.origin + url.pathname, "https://accounts.google.com/o/oauth2/v2/auth");
    assert.equal(url.searchParams.get("client_id"), "client-id");
    assert.equal(
      url.searchParams.get("redirect_uri"),
      "http://localhost:3000/api/auth/google/callback",
    );
    assert.equal(url.searchParams.get("response_type"), "code");
    assert.equal(url.searchParams.get("scope"), "openid email profile");
    assert.equal(url.searchParams.get("state"), "state-123");
    assert.equal(url.searchParams.get("code_challenge"), "challenge");
    assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  });

  it("round-trips the oauth cookie state and sanitises next", () => {
    const encoded = encodeOAuthState({ state: "s", verifier: "v", next: "/listas" });
    assert.match(encoded, /^[A-Za-z0-9_-]+$/);
    assert.deepEqual(decodeOAuthState(encoded), { state: "s", verifier: "v", next: "/listas" });

    const hostile = encodeOAuthState({ state: "s", verifier: "v", next: "https://evil.example" });
    assert.equal(decodeOAuthState(hostile)?.next, "/");
  });

  it("rejects malformed oauth cookie state", () => {
    assert.equal(decodeOAuthState(null), null);
    assert.equal(decodeOAuthState(""), null);
    assert.equal(decodeOAuthState("not-base64-json"), null);
    assert.equal(
      decodeOAuthState(Buffer.from(JSON.stringify({ state: "s" })).toString("base64url")),
      null,
    );
    assert.equal(
      decodeOAuthState(Buffer.from(JSON.stringify([1, 2])).toString("base64url")),
      null,
    );
  });

  it("parses the id token claims it needs", () => {
    assert.deepEqual(
      parseGoogleIdTokenClaims({
        sub: "1234567890",
        email: "  Jorge@Example.com ",
        email_verified: true,
        name: "  Jorge  ",
      }),
      { sub: "1234567890", email: "jorge@example.com", emailVerified: true, name: "Jorge" },
    );
    assert.equal(
      parseGoogleIdTokenClaims({ sub: "1", email: "a@b.c", email_verified: "true" })?.emailVerified,
      true,
    );
    assert.equal(
      parseGoogleIdTokenClaims({ sub: "1", email: "a@b.c" })?.emailVerified,
      false,
    );
    assert.equal(parseGoogleIdTokenClaims({ email: "a@b.c" }), null);
    assert.equal(parseGoogleIdTokenClaims({ sub: "1", email: "nope" }), null);
  });
});
