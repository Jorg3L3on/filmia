import { notFound } from "next/navigation";
import { getLiveSessionUser } from "@/lib/session";

/**
 * Admin panel (FIL-I37): who may open /admin. `ADMIN_EMAILS` is a comma list, compared
 * case-insensitively; empty or unset means nobody.
 */
export const adminEmails = (raw: string | undefined = process.env.ADMIN_EMAILS) =>
  new Set(
    (raw ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );

export const isAdmin = (user: { email?: string | null } | null | undefined, raw?: string) => {
  const email = user?.email?.trim().toLowerCase();
  return Boolean(email) && adminEmails(raw).has(email!);
};

/**
 * Admin rides on the email, and Filmia does not verify an address it is given (signup and the
 * account form take any unused one). So an `ADMIN_EMAILS` address may only stay with the account
 * that already has it: true when `email` is an admin address that is not `currentEmail` (FIL-46).
 * Google sign-in is the one path that may create it, because Google verified the address.
 */
export const isReservedAdminEmail = (email: string, currentEmail?: string | null, raw?: string) => {
  const wanted = email.trim().toLowerCase();
  if (!wanted || !adminEmails(raw).has(wanted)) {
    return false;
  }
  return wanted !== currentEmail?.trim().toLowerCase();
};

/** The admin's session user, or a 404 for everyone else so the page never shows it exists. */
export const requireAdmin = async (loadUser: () => Promise<{ email?: string | null } | null> = getLiveSessionUser) => {
  const user = await loadUser();
  if (!isAdmin(user)) {
    notFound();
  }
  return user!;
};
