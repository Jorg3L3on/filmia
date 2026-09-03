"use server";

import { signOut } from "@/lib/auth";

export const logoutUser = async () => {
  await signOut({ redirectTo: "/login" });
};
