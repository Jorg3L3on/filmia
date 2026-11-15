import { checkRateLimit, RATE_LIMIT_MESSAGE, type RateLimitRule } from "@/lib/rate-limit";
import { postgresRateLimitStore } from "@/lib/rate-limit-store";

/** One more attempt of `userId` against an Extras rule: the message to show when over it, else null. */
export const juegoLimitError = async (rule: RateLimitRule, userId: string, now = new Date()) => {
  const check = await checkRateLimit(postgresRateLimitStore, [{ rule, subject: userId }], now);
  return check.ok ? null : RATE_LIMIT_MESSAGE;
};
