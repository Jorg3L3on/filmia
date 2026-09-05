import { readSessionCookie } from "@/lib/auth";
import { redirect } from "next/navigation";

export const getCurrentSession = async () => readSessionCookie();

export const auth = readSessionCookie;

export const requireUser = async () => {
  const session = await getCurrentSession();
  if (!session?.user?.id) {
    redirect("/login");
  }

  return session.user;
};

export const requireUserId = async () => {
  const user = await requireUser();
  return user.id;
};
