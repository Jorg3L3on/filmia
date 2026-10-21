import { z } from "zod";
import { PERSONAL_TOKEN_LIFETIMES_DAYS } from "@/lib/mcp-oauth/config";
import { createPersonalToken, type OAuthDeps } from "@/lib/mcp-oauth/service";
import { RATE_LIMITS, checkRateLimit, type RateLimitStore } from "@/lib/rate-limit";

/** New personal token from Perfil → Conexiones (FIL-I20-6): 10 an hour per account. */

export const personalTokenFormSchema = z.object({
  name: z.string().trim().min(1, "Ponle un nombre, por ejemplo «Cursor».").max(60),
  days: z.coerce
    .number()
    .refine((value) => (PERSONAL_TOKEN_LIFETIMES_DAYS as readonly number[]).includes(value), "Elige 7, 30 o 90 días."),
  allowWrite: z.boolean(),
});

export type NewPersonalToken =
  | { ok: true; token: string; prefix: string; expiresAt: string }
  | { ok: false; error: string; code: "validation" | "rate_limited" };

export const issuePersonalToken = async (
  deps: OAuthDeps & { rateLimit: RateLimitStore },
  userId: string,
  input: unknown,
): Promise<NewPersonalToken> => {
  const parsed = personalTokenFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: "validation", error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  }
  const limited = await checkRateLimit(deps.rateLimit, [{ rule: RATE_LIMITS.personalTokenAccount, subject: userId }]);
  if (!limited.ok) {
    return {
      ok: false,
      code: "rate_limited",
      error: `Creaste muchos tokens seguidos. Intenta de nuevo en ${Math.ceil(limited.retryAfterSeconds / 60)} min.`,
    };
  }
  const created = await createPersonalToken(deps, { userId, ...parsed.data });
  return { ok: true, token: created.token, prefix: created.tokenPrefix, expiresAt: created.expiresAt.toISOString() };
};
