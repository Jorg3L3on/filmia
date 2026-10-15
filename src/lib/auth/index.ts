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
  sessionVersion: number;
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
    sessionVersion: payload.sessionVersion,
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
 * Re-mint the cookie after a profile change. Claims not passed in `flags` keep their current
 * value, so updating the name mid-Bienvenida does not lift the gate nor reset the version.
 */
export const refreshSessionUser = async (user: SessionUser, flags?: Partial<SessionFlags>) => {
  const current = await readSessionCookie();
  await setSessionOnCookieStore(user, {
    onboarded: current?.onboarded ?? true,
    sessionVersion: current?.sessionVersion ?? 0,
    ...flags,
  });
};

export { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
