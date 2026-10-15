import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  RATE_LIMITS,
  checkRateLimit,
  clientIp,
  memoryRateLimitStore,
  rateLimitKey,
} from "./rate-limit";

const at = (iso: string) => new Date(iso);

describe("auth rate limit (FIL-I10-2)", () => {
  it("blocks the attempt after the limit and says when to retry", async () => {
    const store = memoryRateLimitStore();
    const rule = RATE_LIMITS.loginAccount;
    const now = at("2026-10-13T20:00:00Z");
    for (let attempt = 1; attempt <= rule.limit; attempt += 1) {
      const check = await checkRateLimit(store, [{ rule, subject: "ana@correo.com" }], now);
      assert.deepEqual(check, { ok: true }, `attempt ${attempt}`);
    }
    const blocked = await checkRateLimit(store, [{ rule, subject: "ana@correo.com" }], now);
    assert.deepEqual(blocked, { ok: false, retryAfterSeconds: 15 * 60 });
  });

  it("opens a new window once the old one ends", async () => {
    const store = memoryRateLimitStore();
    const rule = RATE_LIMITS.signupIp;
    const start = at("2026-10-13T20:00:00Z");
    for (let attempt = 0; attempt <= rule.limit; attempt += 1) {
      await checkRateLimit(store, [{ rule, subject: "1.2.3.4" }], start);
    }
    const later = new Date(start.getTime() + rule.windowMs);
    assert.deepEqual(
      await checkRateLimit(store, [{ rule, subject: "1.2.3.4" }], later),
      { ok: true },
    );
  });

  it("limits per account even when the IP changes, and per IP across accounts", async () => {
    const store = memoryRateLimitStore();
    const now = at("2026-10-13T20:00:00Z");
    const login = (ip: string, email: string) =>
      checkRateLimit(
        store,
        [
          { rule: RATE_LIMITS.loginIp, subject: ip },
          { rule: RATE_LIMITS.loginAccount, subject: email },
        ],
        now,
      );

    for (let attempt = 0; attempt < RATE_LIMITS.loginAccount.limit; attempt += 1) {
      await login(`10.0.0.${attempt}`, "ana@correo.com");
    }
    assert.equal((await login("10.0.1.1", "ana@correo.com")).ok, false);
    assert.equal((await login("10.0.1.1", "beto@correo.com")).ok, true);

    for (let attempt = 0; attempt < RATE_LIMITS.loginIp.limit; attempt += 1) {
      await login("9.9.9.9", `user${attempt}@correo.com`);
    }
    assert.equal((await login("9.9.9.9", "nueva@correo.com")).ok, false);
  });

  it("keys never hold the email or IP in clear, and ignore case", () => {
    const key = rateLimitKey(RATE_LIMITS.loginAccount, "Ana@Correo.com ");
    assert.equal(key, rateLimitKey(RATE_LIMITS.loginAccount, "ana@correo.com"));
    assert.match(key, /^login:account:[0-9a-f]{32}$/);
    assert.ok(!key.includes("ana"));
  });

  it("reads the client IP from the first forwarded hop", () => {
    assert.equal(clientIp(new Headers({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" })), "1.2.3.4");
    assert.equal(clientIp(new Headers({ "x-real-ip": "5.6.7.8" })), "5.6.7.8");
    assert.equal(clientIp(new Headers()), "unknown");
  });
});
