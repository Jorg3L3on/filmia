import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  SESSION_COOKIE_NAME,
  type SessionUser,
} from "@/lib/auth/constants";
import {
  createSessionToken,
  sessionCookieOptions,
  verifySessionToken,
} from "@/lib/auth/session-token";

export type AppSession = {
  user: SessionUser;
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
  };
};

export const setSessionCookie = async (
  response: NextResponse,
  user: SessionUser,
) => {
  const token = await createSessionToken(user);
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

export const setSessionOnCookieStore = async (user: SessionUser) => {
  const cookieStore = await cookies();
  const token = await createSessionToken(user);
  cookieStore.set(SESSION_COOKIE_NAME, token, sessionCookieOptions());
};

export const clearSessionOnCookieStore = async () => {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, "", {
    ...sessionCookieOptions(),
    maxAge: 0,
  });
};

export const refreshSessionUser = async (user: SessionUser) => {
  await setSessionOnCookieStore(user);
};

export { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
