import { eq } from "drizzle-orm";
import { db, users } from "@/db";
import {
  hashPassword,
  needsPasswordUpgrade,
  verifyPassword,
} from "@/lib/auth/password";

export type AuthenticatedUser = {
  id: string;
  email: string;
  name: string | null;
};

export type CredentialsResult =
  | { ok: true; user: AuthenticatedUser }
  | { ok: false; reason: "invalid" | "google-only" };

export const authenticateCredentials = async (
  email: string,
  password: string,
): Promise<CredentialsResult> => {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !password) {
    return { ok: false, reason: "invalid" };
  }

  const user = await db.query.users.findFirst({
    where: eq(users.email, normalizedEmail),
  });

  if (!user) {
    return { ok: false, reason: "invalid" };
  }

  if (!user.passwordHash) {
    // Password-less account (signed up with Google). Say so instead of a generic
    // mismatch: this is a personal app, the hint is worth more than the secrecy.
    return { ok: false, reason: user.googleId ? "google-only" : "invalid" };
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return { ok: false, reason: "invalid" };
  }

  if (needsPasswordUpgrade(user.passwordHash)) {
    const passwordHash = await hashPassword(password);
    await db.update(users).set({ passwordHash }).where(eq(users.id, user.id));
  }

  return {
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
    },
  };
};
