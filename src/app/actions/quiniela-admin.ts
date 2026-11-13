"use server";

import { revalidatePath } from "next/cache";
import {
  adminClearOscarWinner,
  adminSetOscarClose,
  adminSetOscarWinner,
  type OscarAdminResult,
} from "@/lib/juegos/oscar/admin";
import { getLiveSessionUser } from "@/lib/session";

const yearOf = (formData: FormData) => Number(formData.get("year"));
const text = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" ? value.slice(0, 120) : "";
};

const refresh = (result: OscarAdminResult) => {
  if (result.ok) {
    revalidatePath("/admin/quiniela");
  }
  return result;
};

/** /admin/quiniela (FIL-I51-4): when the ballots close, in Mexico City time. Admin only. */
export const setOscarCloseAction = async (_state: OscarAdminResult | null, formData: FormData) =>
  refresh(await adminSetOscarClose(await getLiveSessionUser(), { year: yearOf(formData), local: text(formData, "closesAt") }));

/** Enter or correct one category's winner. Admin only. */
export const setOscarWinnerAction = async (_state: OscarAdminResult | null, formData: FormData) =>
  refresh(
    await adminSetOscarWinner(await getLiveSessionUser(), {
      year: yearOf(formData),
      categoryId: text(formData, "categoryId"),
      nomineeId: text(formData, "nomineeId"),
    }),
  );

/** Take a winner back (entered in the wrong category). Admin only. */
export const clearOscarWinnerAction = async (_state: OscarAdminResult | null, formData: FormData) =>
  refresh(
    await adminClearOscarWinner(await getLiveSessionUser(), { year: yearOf(formData), categoryId: text(formData, "categoryId") }),
  );
