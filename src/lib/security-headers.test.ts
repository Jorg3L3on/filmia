import assert from "node:assert/strict";
import { describe, it } from "node:test";
import nextConfig from "../../next.config";
import { FRAME_HOSTS, IMAGE_HOSTS, contentSecurityPolicy, securityHeaders } from "./security-headers";
import { trailerEmbedUrl } from "./tmdb-trailer";

describe("security headers (FIL-I10-6 L1)", () => {
  it("sends CSP, framing, sniffing and referrer headers on every route", async () => {
    const rules = await nextConfig.headers!();
    const all = rules.find((rule) => rule.source === "/:path*");
    const keys = all?.headers.map((header) => header.key) ?? [];
    for (const key of [
      "Content-Security-Policy",
      "X-Frame-Options",
      "X-Content-Type-Options",
      "Referrer-Policy",
    ]) {
      assert.ok(keys.includes(key), key);
    }
    assert.equal(nextConfig.poweredByHeader, false);
  });

  it("forbids framing, plugins and eval in production", () => {
    const csp = contentSecurityPolicy(false);
    assert.match(csp, /frame-ancestors 'none'/);
    assert.match(csp, /object-src 'none'/);
    assert.doesNotMatch(csp, /unsafe-eval/);
    assert.match(contentSecurityPolicy(true), /unsafe-eval/);
    const values = Object.fromEntries(securityHeaders(false).map((h) => [h.key, h.value]));
    assert.equal(values["X-Frame-Options"], "DENY");
    assert.equal(values["X-Content-Type-Options"], "nosniff");
  });

  it("frames only the trailer player (FIL-I15-2)", () => {
    const csp = contentSecurityPolicy(false);
    assert.match(csp, /frame-src https:\/\/www\.youtube-nocookie\.com(;|$)/);
    assert.ok(trailerEmbedUrl("abcDEF12345").startsWith(`${FRAME_HOSTS[0]}/`));
  });

  it("allows every remote image host next/image is configured for", () => {
    const csp = contentSecurityPolicy(false);
    for (const pattern of nextConfig.images?.remotePatterns ?? []) {
      if (pattern instanceof URL) continue;
      const host = `${pattern.protocol}://${pattern.hostname}`;
      assert.ok(IMAGE_HOSTS.includes(host), host);
      assert.ok(csp.includes(host), host);
    }
  });
});
