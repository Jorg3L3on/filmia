"use server";

import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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
import { requireUserId } from "@/lib/session";

export type ProfileActionState = { error: string } | null;

const revalidateProfile = () => {
  revalidatePath("/perfil");
  revalidatePath("/");
  revalidatePath("/watchlist");
  revalidatePath("/titulos", "layout");
};

export const updateStreamingPlatforms = async (formData: FormData) => {
  const userId = await requireUserId();
  const streamingPlatforms = parseStreamingPlatforms(formData);

  await db.update(users).set({ streamingPlatforms }).where(eq(users.id, userId));

  revalidateProfile();
  redirect("/perfil?guardado=plataformas");
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
  redirect("/perfil?guardado=cuenta");
};

export const updatePassword = async (
  _prev: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> => {
  const userId = await requireUserId();

  let currentPassword: string;
  let newPassword: string;

  try {
    ({ currentPassword, newPassword } = parsePasswordChange(formData));
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Datos no válidos.",
    };
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { passwordHash: true },
  });

  if (!user?.passwordHash) {
    return { error: "No se pudo actualizar la contraseña." };
  }

  const valid = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) {
    return { error: "La contraseña actual no es correcta." };
  }

  await db
    .update(users)
    .set({ passwordHash: await hashPassword(newPassword) })
    .where(eq(users.id, userId));

  revalidateProfile();
  redirect("/perfil?guardado=clave");
};
