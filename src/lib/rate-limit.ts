import { createHash } from "node:crypto";

/**
 * Fixed-window rate limiting for the auth endpoints (FIL-I10-2). Pure: the store is
 * injected, so tests run against memory and the app against Postgres (`rate-limit-store`).
 */

export type RateLimitRule = {
  /** Prefix of the counter key, e.g. `login:ip`. */
  name: string;
  limit: number;
  windowMs: number;
};

const MINUTE = 60_000;

export const RATE_LIMITS = {
  loginIp: { name: "login:ip", limit: 30, windowMs: 15 * MINUTE },
  loginAccount: { name: "login:account", limit: 10, windowMs: 15 * MINUTE },
  signupIp: { name: "signup:ip", limit: 5, windowMs: 60 * MINUTE },
  passwordIp: { name: "password:ip", limit: 20, windowMs: 15 * MINUTE },
  passwordAccount: { name: "password:account", limit: 5, windowMs: 15 * MINUTE },
  /** Opening share links (FIL-I18-3): guessing tokens is pointless, but cheap to cap. */
  joinIp: { name: "join:ip", limit: 30, windowMs: 10 * MINUTE },
  joinAccount: { name: "join:account", limit: 10, windowMs: 10 * MINUTE },
} as const satisfies Record<string, RateLimitRule>;

export const RATE_LIMIT_MESSAGE = "Demasiados intentos. Espera unos minutos y vuelve a intentarlo.";

export type RateLimitHit = { count: number; resetAt: Date };

export type RateLimitStore = {
  /** Count one attempt on `key`; opens a new window of `windowMs` when the last one ended. */
  hit: (key: string, windowMs: number, now: Date) => Promise<RateLimitHit>;
};

export type RateLimitCheck = { ok: true } | { ok: false; retryAfterSeconds: number };

/** Emails and IPs never reach the table in clear. */
export const rateLimitKey = (rule: RateLimitRule, subject: string) =>
  `${rule.name}:${createHash("sha256").update(subject.trim().toLowerCase()).digest("hex").slice(0, 32)}`;

/**
 * Count one attempt against every rule; blocked when any of them is past its limit. Every
 * rule counts even when an earlier one already blocks, so a blocked caller keeps paying.
 */
export const checkRateLimit = async (
  store: RateLimitStore,
  attempts: ReadonlyArray<{ rule: RateLimitRule; subject: string }>,
  now = new Date(),
): Promise<RateLimitCheck> => {
  let retryAfterMs = 0;
  for (const { rule, subject } of attempts) {
    const { count, resetAt } = await store.hit(rateLimitKey(rule, subject), rule.windowMs, now);
    if (count > rule.limit) {
      retryAfterMs = Math.max(retryAfterMs, resetAt.getTime() - now.getTime());
    }
  }
  return retryAfterMs > 0
    ? { ok: false, retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)) }
    : { ok: true };
};

/** Client IP as Vercel reports it (first `x-forwarded-for` hop), or a shared bucket. */
export const clientIp = (headers: Headers) =>
  headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
  headers.get("x-real-ip")?.trim() ||
  "unknown";

/** Same semantics as the Postgres store; for tests and scripts. */
export const memoryRateLimitStore = (): RateLimitStore => {
  const rows = new Map<string, RateLimitHit>();
  return {
    hit: async (key, windowMs, now) => {
      const row = rows.get(key);
      const next =
        !row || row.resetAt <= now
          ? { count: 1, resetAt: new Date(now.getTime() + windowMs) }
          : { count: row.count + 1, resetAt: row.resetAt };
      rows.set(key, next);
      return next;
    },
  };
};
