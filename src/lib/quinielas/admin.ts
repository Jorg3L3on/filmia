/**
 * Quinielas de premios (FIL-I51-4): what /admin/quinielas does the night of a ceremony. Every
 * function checks `isAdmin` itself, so a server action reached without the page still refuses.
 */
import { isAdmin } from "@/lib/admin";
import { getCeremony } from "@/lib/quinielas/ceremonies";
import { clearWinner, setClosesAt, setWinner } from "@/lib/quinielas/store";

type Actor = { id: string; email?: string | null } | null | undefined;

export type QuinielaAdminResult = { ok: true } | { ok: false; error: string };

const NOT_ADMIN: QuinielaAdminResult = { ok: false, error: "Solo el admin puede hacer esto." };

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

export const adminSetClose = async (
  actor: Actor,
  input: { ceremonyId: string; local: string },
  adminEmails?: string,
): Promise<QuinielaAdminResult> => {
  if (!actor || !isAdmin(actor, adminEmails)) {
    return NOT_ADMIN;
  }
  const closesAt = mexicoCityLocalToUtc(input.local);
  if (!closesAt || !getCeremony(input.ceremonyId)) {
    return { ok: false, error: "Revisa la fecha y la entrega." };
  }
  await setClosesAt(input.ceremonyId, closesAt);
  return { ok: true };
};

/** Enter or correct a category's winner. Correcting recomputes everyone's hits on the next read. */
export const adminSetWinner = async (
  actor: Actor,
  input: { ceremonyId: string; categoryId: string; nomineeId: string },
  adminEmails?: string,
  now?: Date,
): Promise<QuinielaAdminResult> => {
  if (!actor || !isAdmin(actor, adminEmails)) {
    return NOT_ADMIN;
  }
  try {
    await setWinner({ ...input, enteredByUserId: actor.id, now });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "No se pudo guardar." };
  }
};

export const adminClearWinner = async (
  actor: Actor,
  input: { ceremonyId: string; categoryId: string },
  adminEmails?: string,
): Promise<QuinielaAdminResult> => {
  if (!actor || !isAdmin(actor, adminEmails)) {
    return NOT_ADMIN;
  }
  await clearWinner(input.ceremonyId, input.categoryId);
  return { ok: true };
};
