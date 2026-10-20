"use server";

import { redirect } from "next/navigation";
import { clearSessionOnCookieStore } from "@/lib/auth";
import { safeNextPath } from "@/lib/google-oauth";

/** `callbackUrl`: where to land after signing in again (e.g. «No soy yo» on an invite). */
export const logoutUser = async (callbackUrl?: string) => {
  await clearSessionOnCookieStore();
  const next = safeNextPath(callbackUrl);
  redirect(next === "/" ? "/login" : `/login?callbackUrl=${encodeURIComponent(next)}`);
};
