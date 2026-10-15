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
    sv: flags.sessionVersion,
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
      // Tokens minted before FIL-I10-3 carry no version: they match the column default (0).
      sessionVersion: typeof payload.sv === "number" ? payload.sv : 0,
      iat: payload.iat ?? 0,
      exp: payload.exp ?? 0,
    };
  } catch {
    return null;
  }
};

/**
 * A session is current while its token carries the account's `sessionVersion`. A deleted
 * account (`null`) has no current sessions.
 */
export const isSessionVersionCurrent = (tokenVersion: number, accountVersion: number | null) =>
  accountVersion !== null && tokenVersion === accountVersion;

export const sessionCookieOptions = () => ({
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: process.env.NODE_ENV === "production",
  maxAge: SESSION_MAX_AGE_SECONDS,
});
