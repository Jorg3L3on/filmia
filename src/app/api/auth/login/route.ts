import { NextResponse } from "next/server";
import { authenticateCredentials } from "@/lib/auth/credentials";
import { setSessionCookie } from "@/lib/auth";
import { ONBOARDING_PATH } from "@/lib/onboarding/steps";
import { RATE_LIMITS, clientIp } from "@/lib/rate-limit";
import { checkAuthRateLimit, tooManyAttempts } from "@/lib/rate-limit-store";
import { requestOrigin } from "@/lib/request-origin";

// One message for every failure, so the answer never tells whether an email has an
// account or how it signs in (FIL-I10-6 L2).
const INVALID_CREDENTIALS = "Correo o contraseña incorrectos.";

export const POST = async (request: Request) => {
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return NextResponse.json(
      { error: "Correo y contraseña son obligatorios." },
      { status: 400 },
    );
  }

  // Counted before the password is checked, so guessing costs attempts whether it hits or not.
  const limit = await checkAuthRateLimit([
    { rule: RATE_LIMITS.loginIp, subject: clientIp(request.headers) },
    { rule: RATE_LIMITS.loginAccount, subject: email },
  ]);
  if (!limit.ok) {
    return tooManyAttempts(limit);
  }

  try {
    const result = await authenticateCredentials(email, password);
    if (!result.ok) {
      return NextResponse.json(
        { error: INVALID_CREDENTIALS },
        { status: 401 },
      );
    }

    const wantsHtml = (request.headers.get("accept") ?? "").includes("text/html");
    const landing = result.onboarded ? "/" : ONBOARDING_PATH;
    const response = wantsHtml
      ? NextResponse.redirect(new URL(landing, requestOrigin(request)), 303)
      : NextResponse.json({ ok: true, onboarding: !result.onboarded });
    await setSessionCookie(response, result.user, {
      onboarded: result.onboarded,
      sessionVersion: result.sessionVersion,
    });
    return response;
  } catch (error) {
    // The internal message stays in the logs (FIL-I10-6 L4).
    console.error("[auth/login] failed", error);
    return NextResponse.json(
      { error: "No se pudo iniciar sesión. Reintenta en unos segundos." },
      { status: 500 },
    );
  }
};
