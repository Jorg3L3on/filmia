import { NextResponse } from "next/server";
import { authenticateCredentials } from "@/lib/auth/credentials";
import { setSessionCookie } from "@/lib/auth";
import { ONBOARDING_PATH } from "@/lib/onboarding/steps";
import { RATE_LIMITS, clientIp } from "@/lib/rate-limit";
import { checkAuthRateLimit, tooManyAttempts } from "@/lib/rate-limit-store";
import { requestOrigin } from "@/lib/request-origin";

const FAILURE_MESSAGES = {
  invalid: "Correo o contraseña incorrectos.",
  "google-only": "Esa cuenta entra con Google. Usa «Continuar con Google».",
} as const;

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
        { error: FAILURE_MESSAGES[result.reason] },
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
    const message =
      error instanceof Error ? error.message : "No se pudo iniciar sesión.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
};
