/**
 * Quiniela del Óscar (FIL-I51-4): what /admin/quiniela does the night of the ceremony. Every
 * function checks `isAdmin` itself, so a server action reached without the page still refuses.
 */
import { isAdmin } from "@/lib/admin";
import { getOscarCeremony } from "@/lib/juegos/oscar/ceremonies";
import { clearOscarWinner, setOscarClosesAt, setOscarWinner } from "@/lib/juegos/oscar/store";

type Actor = { id: string; email?: string | null } | null | undefined;

export type OscarAdminResult = { ok: true } | { ok: false; error: string };

const NOT_ADMIN: OscarAdminResult = { ok: false, error: "Solo el admin puede hacer esto." };

/**
 * `datetime-local` («2027-03-14T18:00») in Mexico City time → UTC. Mexico City has kept UTC−6 all
 * year since daylight saving ended in 2022.
 */
export const mexicoCityLocalToUtc = (local: string): Date | null => {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) {
    return null;
  }
  const date = new Date(`${local}:00-06:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

/** The reverse, for the input's value. */
export const utcToMexicoCityLocal = (date: Date) => new Date(date.getTime() - 6 * 3600_000).toISOString().slice(0, 16);

export const adminSetOscarClose = async (
  actor: Actor,
  input: { year: number; local: string },
  adminEmails?: string,
): Promise<OscarAdminResult> => {
  if (!actor || !isAdmin(actor, adminEmails)) {
    return NOT_ADMIN;
  }
  const closesAt = mexicoCityLocalToUtc(input.local);
  if (!closesAt || !getOscarCeremony(input.year)) {
    return { ok: false, error: "Revisa la fecha y la entrega." };
  }
  await setOscarClosesAt(input.year, closesAt);
  return { ok: true };
};

/** Enter or correct a category's winner. Correcting recomputes everyone's hits on the next read. */
export const adminSetOscarWinner = async (
  actor: Actor,
  input: { year: number; categoryId: string; nomineeId: string },
  adminEmails?: string,
  now?: Date,
): Promise<OscarAdminResult> => {
  if (!actor || !isAdmin(actor, adminEmails)) {
    return NOT_ADMIN;
  }
  try {
    await setOscarWinner({ ...input, enteredByUserId: actor.id, now });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "No se pudo guardar." };
  }
};

export const adminClearOscarWinner = async (
  actor: Actor,
  input: { year: number; categoryId: string },
  adminEmails?: string,
): Promise<OscarAdminResult> => {
  if (!actor || !isAdmin(actor, adminEmails)) {
    return NOT_ADMIN;
  }
  await clearOscarWinner(input.year, input.categoryId);
  return { ok: true };
};
