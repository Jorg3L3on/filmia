import { SignJWT, jwtVerify } from "jose";
import {
  DEFAULT_SESSION_FLAGS,
  SESSION_MAX_AGE_SECONDS,
  resolveAuthSecret,
  type SessionFlags,
  type SessionPayload,
  type SessionUser,
} from "@/lib/auth/constants";

const encoder = new TextEncoder();

const getSecretKey = () => {
  const secret = resolveAuthSecret();
  if (!secret) {
    throw new Error("AUTH_SECRET no está configurado.");
  }

  return encoder.encode(secret);
};

export const createSessionToken = async (
  user: SessionUser,
  flags: SessionFlags = DEFAULT_SESSION_FLAGS,
) => {
  const now = Math.floor(Date.now() / 1000);

  return new SignJWT({
    id: user.id,
    email: user.email,
    name: user.name,
    onboarded: flags.onboarded,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setExpirationTime(now + SESSION_MAX_AGE_SECONDS)
    .sign(getSecretKey());
};

export const verifySessionToken = async (
  token: string,
): Promise<SessionPayload | null> => {
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), {
      algorithms: ["HS256"],
    });

    if (typeof payload.id !== "string" || typeof payload.email !== "string") {
      return null;
    }

    const name =
      typeof payload.name === "string"
        ? payload.name
        : payload.name == null
          ? null
          : null;

    return {
      id: payload.id,
      email: payload.email,
      name,
      // Tokens minted before the Bienvenida existed carry no claim: those sessions are never gated.
      onboarded: payload.onboarded !== false,
      iat: payload.iat ?? 0,
      exp: payload.exp ?? 0,
    };
  } catch {
    return null;
  }
};

export const sessionCookieOptions = () => ({
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: process.env.NODE_ENV === "production",
  maxAge: SESSION_MAX_AGE_SECONDS,
});
