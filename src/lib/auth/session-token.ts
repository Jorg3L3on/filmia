import { SignJWT, jwtVerify } from "jose";
import {
  SESSION_MAX_AGE_SECONDS,
  resolveAuthSecret,
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

export const createSessionToken = async (user: SessionUser) => {
  const now = Math.floor(Date.now() / 1000);

  return new SignJWT({
    id: user.id,
    email: user.email,
    name: user.name,
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
