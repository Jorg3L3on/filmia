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

export const authenticateCredentials = async (
  email: string,
  password: string,
): Promise<AuthenticatedUser | null> => {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !password) {
    return null;
  }

  const user = await db.query.users.findFirst({
    where: eq(users.email, normalizedEmail),
  });

  if (!user?.passwordHash) {
    return null;
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return null;
  }

  if (needsPasswordUpgrade(user.passwordHash)) {
    const passwordHash = await hashPassword(password);
    await db.update(users).set({ passwordHash }).where(eq(users.id, user.id));
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
  };
};
