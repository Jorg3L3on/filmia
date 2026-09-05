"use server";

import { redirect } from "next/navigation";
import { clearSessionOnCookieStore } from "@/lib/auth";

export const logoutUser = async () => {
  await clearSessionOnCookieStore();
  redirect("/login");
};
