import { createId } from "@paralleldrive/cuid2";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, users } from "@/db";
import { setSessionCookie } from "@/lib/auth";
import { hashPassword } from "@/lib/auth/password";
import { ensureDefaultLists } from "@/lib/lists";
import { ONBOARDING_PATH } from "@/lib/onboarding/steps";
import { RATE_LIMITS, clientIp } from "@/lib/rate-limit";
import { checkAuthRateLimit, tooManyAttempts } from "@/lib/rate-limit-store";
import {
  SIGNUP_EMAIL_UNAVAILABLE,
  SIGNUP_FIELD_ORDER,
  normalizeEmail,
  validateSignup,
} from "@/lib/signup-validation";

export const POST = async (request: Request) => {
  const formData = await request.formData();
  const rawEmail = String(formData.get("email") ?? "");
  const email = normalizeEmail(rawEmail);
  const password = String(formData.get("password") ?? "");
  const rawName = String(formData.get("name") ?? "");
  const name = rawName.trim() || null;

  const fieldErrors = validateSignup({ name: rawName, email: rawEmail, password });
  const [firstInvalid] = SIGNUP_FIELD_ORDER.filter((field) => fieldErrors[field]);
  if (firstInvalid) {
    return NextResponse.json(
      { error: fieldErrors[firstInvalid], fieldErrors },
      { status: 400 },
    );
  }

  // Counted after validation so typos don't burn the budget; the existing-email answer counts.
  const limit = await checkAuthRateLimit([
    { rule: RATE_LIMITS.signupIp, subject: clientIp(request.headers) },
  ]);
  if (!limit.ok) {
    return tooManyAttempts(limit);
  }

  const existing = await db.query.users.findFirst({
    where: eq(users.email, email),
    columns: { id: true, passwordHash: true, googleId: true },
  });

  if (existing) {
    // One answer for every existing account, whatever its sign-in method (FIL-I41-11): the
    // reply must not tell a stranger how someone signs in, and carries no account flag.
    return NextResponse.json(
      { error: SIGNUP_EMAIL_UNAVAILABLE, fieldErrors: { email: SIGNUP_EMAIL_UNAVAILABLE } },
      { status: 400 },
    );
  }

  const passwordHash = await hashPassword(password);
  const userId = createId();

  await db.insert(users).values({
    id: userId,
    email,
    passwordHash,
    name,
  });

  await ensureDefaultLists(userId);

  // New accounts go through the Bienvenida first; the claim lifts when they finish or skip it.
  const response = NextResponse.json({ ok: true, onboarding: true, next: ONBOARDING_PATH });
  await setSessionCookie(response, { id: userId, email, name }, {
    onboarded: false,
    sessionVersion: 0,
  });
  return response;
};
