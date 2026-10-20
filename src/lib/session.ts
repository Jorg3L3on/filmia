import { cache } from "react";
import { readSessionCookie } from "@/lib/auth";
import { isSessionCurrent } from "@/lib/auth/session-version";
import { redirect } from "next/navigation";

export const getCurrentSession = cache(async () => readSessionCookie());

export const auth = getCurrentSession;

export const requireUser = cache(async () => {
  const session = await getCurrentSession();
  if (!session?.user?.id) {
    redirect("/login");
  }

  return session.user;
});

export const requireUserId = cache(async () => {
  const user = await requireUser();
  return user.id;
});

/**
 * For public paths the proxy does not check: the signed-in user only while
 * their session has not been revoked by a password change (FIL-I10-3).
 */
export const getLiveSessionUser = cache(async () => {
  const session = await getCurrentSession();
  if (!session?.user?.id) {
    return null;
  }
  const current = await isSessionCurrent({ id: session.user.id, sessionVersion: session.sessionVersion });
  return current ? session.user : null;
});
