import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  SESSION_COOKIE_NAME,
  type SessionFlags,
  type SessionUser,
} from "@/lib/auth/constants";
import {
  createSessionToken,
  sessionCookieOptions,
  verifySessionToken,
} from "@/lib/auth/session-token";

export type AppSession = {
  user: SessionUser;
  /** False only while a new account has not finished (or skipped) the Bienvenida. */
  onboarded: boolean;
};

export const readSessionCookie = async (): Promise<AppSession | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }

  const payload = await verifySessionToken(token);
  if (!payload) {
    return null;
  }

  return {
    user: {
      id: payload.id,
      email: payload.email,
      name: payload.name,
    },
    onboarded: payload.onboarded,
  };
};

export const setSessionCookie = async (
  response: NextResponse,
  user: SessionUser,
  flags?: SessionFlags,
) => {
  const token = await createSessionToken(user, flags);
  response.cookies.set(SESSION_COOKIE_NAME, token, sessionCookieOptions());
  return response;
};

export const clearSessionCookie = (response: NextResponse) => {
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    ...sessionCookieOptions(),
    maxAge: 0,
  });
  return response;
};

export const setSessionOnCookieStore = async (user: SessionUser, flags?: SessionFlags) => {
  const cookieStore = await cookies();
  const token = await createSessionToken(user, flags);
  cookieStore.set(SESSION_COOKIE_NAME, token, sessionCookieOptions());
};

export const clearSessionOnCookieStore = async () => {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, "", {
    ...sessionCookieOptions(),
    maxAge: 0,
  });
};

/**
 * Re-mint the cookie after a profile change. Without `flags` the current `onboarded` claim is
 * preserved, so updating the name mid-Bienvenida does not lift the gate.
 */
export const refreshSessionUser = async (user: SessionUser, flags?: SessionFlags) => {
  const current = flags ?? { onboarded: (await readSessionCookie())?.onboarded ?? true };
  await setSessionOnCookieStore(user, current);
};

export { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
