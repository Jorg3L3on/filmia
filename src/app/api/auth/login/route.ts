import { NextResponse } from "next/server";
import { authenticateCredentials } from "@/lib/auth/credentials";
import { setSessionCookie } from "@/lib/auth";

const requestOrigin = (request: Request) => {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (host) {
    const proto = request.headers.get("x-forwarded-proto") ?? "http";
    return `${proto}://${host}`;
  }
  return new URL(request.url).origin.replace("://0.0.0.0", "://127.0.0.1");
};

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

  try {
    const user = await authenticateCredentials(email, password);
    if (!user) {
      return NextResponse.json(
        { error: "Correo o contraseña incorrectos." },
        { status: 401 },
      );
    }

    const wantsHtml = (request.headers.get("accept") ?? "").includes("text/html");
    const response = wantsHtml
      ? NextResponse.redirect(new URL("/", requestOrigin(request)), 303)
      : NextResponse.json({ ok: true });
    await setSessionCookie(response, user);
    return response;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo iniciar sesión.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
};
