import { cache } from "react";
import { readSessionCookie } from "@/lib/auth";
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
