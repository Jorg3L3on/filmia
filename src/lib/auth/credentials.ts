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
  | { ok: true; user: AuthenticatedUser; onboarded: boolean; sessionVersion: number }
  | { ok: false; reason: "invalid" };

let decoyHash: Promise<string> | null = null;

/**
 * Hash a throwaway password when there is no real hash to check, so an unknown email or a
 * Google-only account answers in the same time as a wrong password (FIL-I10-6 L2).
 */
const spendPasswordCheck = async (password: string) => {
  decoyHash ??= hashPassword("filmia-decoy-password");
  await verifyPassword(password, await decoyHash);
};

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
    columns: { id: true, email: true, name: true, passwordHash: true, onboardedAt: true, sessionVersion: true },
  });

  // Unknown email and password-less (Google) account fail exactly like a wrong password.
  if (!user?.passwordHash) {
    await spendPasswordCheck(password);
    return { ok: false, reason: "invalid" };
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
    onboarded: user.onboardedAt != null,
    sessionVersion: user.sessionVersion,
  };
};
