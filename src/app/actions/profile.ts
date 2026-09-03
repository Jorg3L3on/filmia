"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseStreamingPlatforms } from "@/lib/form-data";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";

const revalidateStreamingPrefs = () => {
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

  revalidateStreamingPrefs();
  redirect("/perfil?guardado=1");
};
