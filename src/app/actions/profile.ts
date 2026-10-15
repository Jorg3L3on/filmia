"use server";

import { and, eq, ne, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { db, users } from "@/db";
import { refreshSessionUser } from "@/lib/auth";
import {
  hashPassword,
  verifyPassword,
} from "@/lib/auth/password";
import {
  parseAccountEmail,
  parseOptionalDisplayName,
  parsePasswordChange,
  parseStreamingPlatforms,
} from "@/lib/form-data";
import { RATE_LIMITS, RATE_LIMIT_MESSAGE, clientIp } from "@/lib/rate-limit";
import { checkAuthRateLimit } from "@/lib/rate-limit-store";
import { revalidateProfileSurfaces } from "@/lib/revalidate-surfaces";
import { requireUser, requireUserId } from "@/lib/session";
import { scheduleTonightRecompute } from "@/lib/tonight-store";

export type ProfileActionState = { error: string } | { ok: true } | null;

const revalidateProfile = () => {
  revalidateProfileSurfaces();
};

export const updateStreamingPlatforms = async (formData: FormData) => {
  const userId = await requireUserId();
  const streamingPlatforms = parseStreamingPlatforms(formData);

  await db.update(users).set({ streamingPlatforms }).where(eq(users.id, userId));

  revalidateProfile();
  scheduleTonightRecompute(userId);
};

export const updateAccount = async (
  _prev: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> => {
  const userId = await requireUserId();

  let name: string | null;
  let email: string;

  try {
    name = parseOptionalDisplayName(formData.get("name"));
    email = parseAccountEmail(formData.get("email"));
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Datos no válidos.",
    };
  }

  const duplicate = await db.query.users.findFirst({
    where: and(eq(users.email, email), ne(users.id, userId)),
    columns: { id: true },
  });

  if (duplicate) {
    return { error: "Ya existe una cuenta con ese correo." };
  }

  await db.update(users).set({ name, email }).where(eq(users.id, userId));

  await refreshSessionUser({ id: userId, email, name });

  revalidateProfile();
  return { ok: true };
};

export const updatePassword = async (
  _prev: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> => {
  const sessionUser = await requireUser();
  const userId = sessionUser.id;

  let currentPassword: string;
  let newPassword: string;

  try {
    ({ currentPassword, newPassword } = parsePasswordChange(formData));
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Datos no válidos.",
    };
  }

  const limit = await checkAuthRateLimit([
    { rule: RATE_LIMITS.passwordIp, subject: clientIp(await headers()) },
    { rule: RATE_LIMITS.passwordAccount, subject: userId },
  ]);
  if (!limit.ok) {
    return { error: RATE_LIMIT_MESSAGE };
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { passwordHash: true },
  });

  if (!user?.passwordHash) {
    return {
      error: "Esta cuenta entra con Google y no tiene contraseña que cambiar.",
    };
  }

  const valid = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) {
    return { error: "La contraseña actual no es correcta." };
  }

  // Bumping the version signs out every other session (FIL-I10-3); this one gets a fresh cookie.
  const [updated] = await db
    .update(users)
    .set({
      passwordHash: await hashPassword(newPassword),
      sessionVersion: sql`${users.sessionVersion} + 1`,
    })
    .where(eq(users.id, userId))
    .returning({ sessionVersion: users.sessionVersion });

  if (updated) {
    await refreshSessionUser(sessionUser, { sessionVersion: updated.sessionVersion });
  }

  revalidateProfile();
  return { ok: true };
};
