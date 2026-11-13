"use server";

import { revalidatePath } from "next/cache";
import { adminClearWinner, adminSetClose, adminSetWinner, type QuinielaAdminResult } from "@/lib/quinielas/admin";
import { getLiveSessionUser } from "@/lib/session";

const text = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" ? value.slice(0, 120) : "";
};

const refresh = (ceremonyId: string, result: QuinielaAdminResult) => {
  if (result.ok) {
    revalidatePath(`/admin/quinielas/${ceremonyId}`);
  }
  return result;
};

/** /admin/quinielas (FIL-I51-4): when a ceremony's ballots close, in Mexico City time. Admin only. */
export const setCloseAction = async (_state: QuinielaAdminResult | null, formData: FormData) => {
  const ceremonyId = text(formData, "ceremonyId");
  return refresh(ceremonyId, await adminSetClose(await getLiveSessionUser(), { ceremonyId, local: text(formData, "closesAt") }));
};

/** Enter or correct one category's winner. Admin only. */
export const setWinnerAction = async (_state: QuinielaAdminResult | null, formData: FormData) => {
  const ceremonyId = text(formData, "ceremonyId");
  return refresh(
    ceremonyId,
    await adminSetWinner(await getLiveSessionUser(), {
      ceremonyId,
      categoryId: text(formData, "categoryId"),
      nomineeId: text(formData, "nomineeId"),
    }),
  );
};

/** Take a winner back (entered in the wrong category). Admin only. */
export const clearWinnerAction = async (_state: QuinielaAdminResult | null, formData: FormData) => {
  const ceremonyId = text(formData, "ceremonyId");
  return refresh(ceremonyId, await adminClearWinner(await getLiveSessionUser(), { ceremonyId, categoryId: text(formData, "categoryId") }));
};
