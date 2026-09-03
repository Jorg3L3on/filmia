import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export const getCurrentSession = async () => auth();

export const requireUser = async () => {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  return session.user;
};

export const requireUserId = async () => {
  const user = await requireUser();
  return user.id;
};
