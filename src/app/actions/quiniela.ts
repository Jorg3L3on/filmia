"use server";

import { redirect } from "next/navigation";
import { oscarSeasonYear } from "@/lib/quinielas/ceremonies";
import {
  createOscarGroup,
  deleteOscarGroup,
  joinOscarGroup,
  leaveOscarGroup,
  regenerateOscarGroupLink,
} from "@/lib/quinielas/groups";
import { castOscarVote, type CastOscarVoteResult } from "@/lib/quinielas/store";
import { requireUserId } from "@/lib/session";

/**
 * Quiniela del Óscar (FIL-I51-2): vote (or change the vote) in one category of this season's
 * ballot. The store refuses it once the ballot is closed, whatever the page showed.
 */
export const voteOscar = async (categoryId: unknown, nomineeId: unknown): Promise<CastOscarVoteResult> => {
  const userId = await requireUserId();
  if (typeof categoryId !== "string" || typeof nomineeId !== "string" || categoryId.length > 80 || nomineeId.length > 120) {
    return { ok: false, reason: "invalida" };
  }
  // No revalidatePath: the ballot pages are dynamic, and a refresh per tap would slow the queue
  // of votes (server actions run one at a time).
  return castOscarVote({ userId, year: oscarSeasonYear(), categoryId, nomineeId });
};

// ── Groups (FIL-I51-3) ───────────────────────────────────────────────────

export type GroupActionState = { error: string | null };

/** «Retar a alguien»: a new group for this season, then its page with the link to send. */
export const createOscarGroupAction = async (_state: GroupActionState, formData: FormData): Promise<GroupActionState> => {
  const userId = await requireUserId();
  let groupId: string;
  try {
    ({ id: groupId } = await createOscarGroup({ ownerId: userId, year: oscarSeasonYear(), name: formData.get("name") }));
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo crear el grupo." };
  }
  redirect(`/extras/quinielas/grupo/${groupId}?nuevo=1`);
};

/** «Entrar al grupo» from an invite link. */
export const joinOscarGroupAction = async (token: unknown): Promise<GroupActionState> => {
  const userId = await requireUserId();
  if (typeof token !== "string") {
    return { error: "Este enlace ya no sirve." };
  }
  const result = await joinOscarGroup(token, userId);
  if (!result.ok) {
    return { error: result.reason === "lleno" ? "Este grupo ya está lleno." : "Este enlace ya no sirve." };
  }
  redirect(`/extras/quinielas/grupo/${result.groupId}`);
};

/** «Nuevo enlace»: the path of the new link, or null when the caller does not own the group. */
export const regenerateOscarGroupLinkAction = async (groupId: unknown): Promise<string | null> => {
  const userId = await requireUserId();
  return typeof groupId === "string" ? regenerateOscarGroupLink(groupId, userId) : null;
};

export const leaveOscarGroupAction = async (groupId: unknown): Promise<GroupActionState> => {
  const userId = await requireUserId();
  if (typeof groupId !== "string" || !(await leaveOscarGroup(groupId, userId))) {
    return { error: "No se pudo salir del grupo." };
  }
  redirect("/extras/quinielas/grupos");
};

export const deleteOscarGroupAction = async (groupId: unknown): Promise<GroupActionState> => {
  const userId = await requireUserId();
  if (typeof groupId !== "string" || !(await deleteOscarGroup(groupId, userId))) {
    return { error: "No se pudo borrar el grupo." };
  }
  redirect("/extras/quinielas/grupos");
};
