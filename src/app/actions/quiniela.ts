"use server";

import { redirect } from "next/navigation";
import { getCeremony } from "@/lib/quinielas/ceremonies";
import {
  createGroup,
  deleteGroup,
  getGroupForMember,
  joinGroup,
  leaveGroup,
  regenerateGroupLink,
} from "@/lib/quinielas/groups";
import { ceremonyPath } from "@/lib/quinielas/hub-core";
import { castVote, type CastVoteResult } from "@/lib/quinielas/store";
import { requireUserId } from "@/lib/session";

const isShortString = (value: unknown, max: number): value is string => typeof value === "string" && value.length <= max;

/**
 * Quinielas (FIL-I51-2): vote (or change the vote) in one category of a ceremony's ballot. The store
 * refuses it once the ballot is closed, whatever the page showed.
 */
export const vote = async (ceremonyId: unknown, categoryId: unknown, nomineeId: unknown): Promise<CastVoteResult> => {
  const userId = await requireUserId();
  if (!isShortString(ceremonyId, 40) || !isShortString(categoryId, 80) || !isShortString(nomineeId, 120)) {
    return { ok: false, reason: "invalida" };
  }
  // No revalidatePath: the ballot pages are dynamic, and a refresh per tap would slow the queue
  // of votes (server actions run one at a time).
  return castVote({ userId, ceremonyId, categoryId, nomineeId });
};

// ── Groups (FIL-I51-3) ───────────────────────────────────────────────────

export type GroupActionState = { error: string | null };

/** «Retar a alguien»: a new group for the ceremony, then its page with the link to send. */
export const createGroupAction = async (_state: GroupActionState, formData: FormData): Promise<GroupActionState> => {
  const userId = await requireUserId();
  const ceremonyId = formData.get("ceremonyId");
  if (!getCeremony(ceremonyId)) {
    return { error: "Esta entrega no tiene quiniela." };
  }
  let groupId: string;
  try {
    ({ id: groupId } = await createGroup({ ownerId: userId, ceremonyId: ceremonyId as string, name: formData.get("name") }));
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo crear el grupo." };
  }
  redirect(`/extras/quinielas/grupo/${groupId}?nuevo=1`);
};

/** «Entrar al grupo» from an invite link. */
export const joinGroupAction = async (token: unknown): Promise<GroupActionState> => {
  const userId = await requireUserId();
  if (typeof token !== "string") {
    return { error: "Este enlace ya no sirve." };
  }
  const result = await joinGroup(token, userId);
  if (!result.ok) {
    return { error: result.reason === "lleno" ? "Este grupo ya está lleno." : "Este enlace ya no sirve." };
  }
  redirect(`/extras/quinielas/grupo/${result.groupId}`);
};

/** «Nuevo enlace»: the path of the new link, or null when the caller does not own the group. */
export const regenerateGroupLinkAction = async (groupId: unknown): Promise<string | null> => {
  const userId = await requireUserId();
  return typeof groupId === "string" ? regenerateGroupLink(groupId, userId) : null;
};

export const leaveGroupAction = async (groupId: unknown): Promise<GroupActionState> => {
  const userId = await requireUserId();
  const group = typeof groupId === "string" ? await getGroupForMember(groupId, userId) : null;
  if (!group || !(await leaveGroup(group.id, userId))) {
    return { error: "No se pudo salir del grupo." };
  }
  redirect(`${ceremonyPath(group.ceremonyId)}/grupos`);
};

export const deleteGroupAction = async (groupId: unknown): Promise<GroupActionState> => {
  const userId = await requireUserId();
  const ceremonyId = typeof groupId === "string" ? await deleteGroup(groupId, userId) : null;
  if (!ceremonyId) {
    return { error: "No se pudo borrar el grupo." };
  }
  redirect(`${ceremonyPath(ceremonyId)}/grupos`);
};
