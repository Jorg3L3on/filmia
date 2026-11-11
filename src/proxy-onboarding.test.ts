import { testDatabaseUrl } from "@/lib/test-support/local-db";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { createSessionToken } from "@/lib/auth/session-token";
import { safeNextPath } from "@/lib/google-oauth";
import { consentLoginHref } from "@/lib/mcp-oauth/config";
import { ONBOARDING_PATH, onboardingHref } from "@/lib/onboarding/steps";
import { seeder } from "@/lib/test-support/seed";
import { proxy } from "./proxy";

process.env.AUTH_SECRET ??= "test-secret-for-proxy-onboarding";

const CONSENT =
  "/oauth/consent?client_id=https%3A%2F%2Fclaude.ai%2Fcimd&redirect_uri=https%3A%2F%2Fclaude.ai%2Fapi%2Fmcp%2Fauth_callback&state=s1&code_challenge=abc&code_challenge_method=S256";

const request = (path: string, token?: string) =>
  new Request(`https://filmia.test${path}`, {
    headers: {
      host: "filmia.test",
      ...(token ? { cookie: `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}` } : {}),
    },
  });

const locationOf = (response: Response) => new URL(response.headers.get("location")!);

describe("onboardingHref (FIL-41)", () => {
  it("carries a same-origin path as callbackUrl and nothing for Hoy", () => {
    assert.equal(onboardingHref("/"), ONBOARDING_PATH);
    assert.equal(onboardingHref(CONSENT), `${ONBOARDING_PATH}?callbackUrl=${encodeURIComponent(CONSENT)}`);
  });

  it("never carries an off-site return once it went through safeNextPath", () => {
    for (const evil of ["//evil.com", "https://evil.com", "/\\evil.com", "/\t/evil.com", "javascript:alert(1)"]) {
      assert.equal(onboardingHref(safeNextPath(evil)), ONBOARDING_PATH, evil);
    }
  });
});

describe("consentLoginHref (FIL-41)", () => {
  it("sends /login back to the same consent request", () => {
    const href = new URL(consentLoginHref({ client_id: "abc", state: "s 1" }), "https://filmia.test");
    assert.equal(href.pathname, "/login");
    assert.equal(href.searchParams.get("callbackUrl"), "/oauth/consent?client_id=abc&state=s+1");
  });
});

describe("proxy: an account that still owes the Bienvenida (FIL-41)", () => {
  const seed = seeder("proxy-onb");
  let token = "";

  before(async () => {
    // Without a test database the session-version check fails open, so any id works; with one,
    // the account has to exist for the token to be current.
    const id = testDatabaseUrl ? await seed.user("Nueva") : "proxy-onb-sin-base";
    token = await createSessionToken(
      { id, email: `${id}@filmia.test`, name: "Nueva" },
      { onboarded: false, sessionVersion: 0 },
    );
  });

  after(async () => {
    if (testDatabaseUrl) await seed.cleanup();
  });

  it("goes to the Bienvenida keeping the consent request it opened", async () => {
    const response = await proxy(request(CONSENT, token));
    const location = locationOf(response);
    assert.equal(location.pathname, ONBOARDING_PATH);
    assert.equal(location.searchParams.get("callbackUrl"), CONSENT);
  });

  it("drops Next's _rsc cache-buster from the carried path", async () => {
    const response = await proxy(request("/listas?tab=mias&_rsc=1x2y", token));
    assert.equal(locationOf(response).searchParams.get("callbackUrl"), "/listas?tab=mias");
  });

  it("carries nothing when it was headed to Hoy", async () => {
    const location = locationOf(await proxy(request("/", token)));
    assert.equal(`${location.pathname}${location.search}`, ONBOARDING_PATH);
  });

  it("keeps /login's callbackUrl when it signs in and is bounced to the Bienvenida", async () => {
    const response = await proxy(request(`/login?callbackUrl=${encodeURIComponent(CONSENT)}`, token));
    assert.equal(locationOf(response).searchParams.get("callbackUrl"), CONSENT);
  });

  it("ignores an off-site callbackUrl on /login", async () => {
    const response = await proxy(request(`/login?callbackUrl=${encodeURIComponent("//evil.com")}`, token));
    const location = locationOf(response);
    assert.equal(`${location.pathname}${location.search}`, ONBOARDING_PATH);
  });

  it("lets the Bienvenida itself through with its callbackUrl", async () => {
    const response = await proxy(request(`${ONBOARDING_PATH}?callbackUrl=${encodeURIComponent(CONSENT)}`, token));
    assert.equal(response.headers.get("location"), null);
  });
});
