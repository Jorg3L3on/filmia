"use server";

import { compare, hash } from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { unstable_update as updateSession } from "@/lib/auth";
import {
  parseAccountEmail,
  parseOptionalDisplayName,
  parsePasswordChange,
  parseStreamingPlatforms,
} from "@/lib/form-data";
import { prisma } from "@/lib/prisma";
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

  await prisma.user.update({
    where: { id: userId },
    data: { streamingPlatforms },
  });

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

  const duplicate = await prisma.user.findFirst({
    where: { email, NOT: { id: userId } },
    select: { id: true },
  });

  if (duplicate) {
    return { error: "Ya existe una cuenta con ese correo." };
  }

  await prisma.user.update({
    where: { id: userId },
    data: { name, email },
  });

  await updateSession({
    user: { name, email },
  });

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

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });

  if (!user?.passwordHash) {
    return { error: "No se pudo actualizar la contraseña." };
  }

  const valid = await compare(currentPassword, user.passwordHash);
  if (!valid) {
    return { error: "La contraseña actual no es correcta." };
  }

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hash(newPassword, 12) },
  });

  revalidateProfile();
  redirect("/perfil?guardado=clave");
};
