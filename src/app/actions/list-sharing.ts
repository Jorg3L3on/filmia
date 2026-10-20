"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import type { ListInviteKind, ListRole } from "@/db";
import { requireListAccess } from "@/lib/list-access";
import { shareableRoles } from "@/lib/list-access-core";
import { invitePath } from "@/lib/list-invites-core";
import {
  cancelJoinRequest,
  createListInvite,
  decideJoinRequest,
  dismissJoinOutcome,
  removeMember,
  requestToJoin,
  setInviteDisabled,
  setMemberRole,
  type JoinOutcome,
} from "@/lib/list-invites";
import { checkAuthRateLimit } from "@/lib/rate-limit-store";
import { clientIp, RATE_LIMITS, RATE_LIMIT_MESSAGE } from "@/lib/rate-limit";
import { getLiveSessionUser, requireUserId } from "@/lib/session";

/**
 * Sharing a list (FIL-I18-3/4). Only the owner invites, approves, changes
 * roles and takes people out; anyone on the list can leave it.
 */

const ROLES: readonly ListRole[] = ["EDITOR", "VIEWER"];
const KINDS: readonly ListInviteKind[] = ["PERSONAL", "GROUP"];

const revalidateSharing = (listId: string) => {
  revalidatePath("/listas");
  revalidatePath(`/listas/${listId}`);
  revalidatePath(`/listas/${listId}/miembros`);
};

export type CreateInviteResult = { ok: true; path: string } | { ok: false; error: string };

/** A new link; its token is only ever shown here. */
export const createInvite = async (
  listId: string,
  input: { kind: ListInviteKind; role: ListRole; maxUses?: number },
): Promise<CreateInviteResult> => {
  try {
    const { userId, list } = await requireListAccess(listId, "manage");
    if (!KINDS.includes(input.kind) || !ROLES.includes(input.role)) {
      return { ok: false, error: "Datos no válidos." };
    }
    const { token } = await createListInvite({
      listId,
      ownerId: userId,
      kind: input.kind,
      role: input.role,
      groupMaxUses: input.maxUses,
      list,
    });
    revalidateSharing(listId);
    return { ok: true, path: invitePath(token) };
  } catch (caught) {
    return { ok: false, error: caught instanceof Error ? caught.message : "No se pudo crear el link." };
  }
};

export const toggleInvite = async (listId: string, inviteId: string, disabled: boolean) => {
  await requireListAccess(listId, "manage");
  await setInviteDisabled(listId, inviteId, disabled);
  revalidateSharing(listId);
};

export const decideRequests = async (
  listId: string,
  requestIds: string[],
  decision: "approve" | "reject",
) => {
  const { userId } = await requireListAccess(listId, "manage");
  const decided = await decideJoinRequest(listId, userId, requestIds, decision);
  revalidateSharing(listId);
  return decided;
};

export const changeMemberRole = async (listId: string, memberId: string, role: ListRole) => {
  const { list } = await requireListAccess(listId, "manage");
  if (!shareableRoles(list).includes(role)) {
    throw new Error("Ese rol no está disponible en esta lista.");
  }
  await setMemberRole(listId, memberId, role);
  revalidateSharing(listId);
};

export const removeListMember = async (listId: string, memberId: string) => {
  await requireListAccess(listId, "manage");
  await removeMember(listId, memberId);
  revalidateSharing(listId);
};

/** «Salir de la lista». The owner cannot leave their own list. */
export const leaveList = async (listId: string) => {
  const { userId, role } = await requireListAccess(listId, "read");
  if (role === "OWNER") {
    throw new Error("Eres la persona dueña de esta lista.");
  }
  await removeMember(listId, userId);
  revalidatePath("/listas");
};

export type JoinActionResult = JoinOutcome | { status: "rate_limited"; error: string };

/** «Solicitar unirme» from `/unirse/[token]`. */
export const joinWithInvite = async (token: string): Promise<JoinActionResult> => {
  // `/unirse` is public, so the proxy did not check the session: do it here.
  const user = await getLiveSessionUser();
  if (!user) {
    return { status: "unavailable" };
  }
  const userId = user.id;
  const limit = await checkAuthRateLimit([
    { rule: RATE_LIMITS.joinIp, subject: clientIp(await headers()) },
    { rule: RATE_LIMITS.joinAccount, subject: userId },
  ]);
  if (!limit.ok) {
    return { status: "rate_limited", error: RATE_LIMIT_MESSAGE };
  }
  const outcome = await requestToJoin(userId, token);
  if (outcome.status !== "unavailable") {
    revalidatePath("/listas");
    revalidatePath(`/listas/${outcome.listId}/miembros`);
  }
  return outcome;
};

export const cancelMyRequest = async (requestId: string) => {
  const userId = await requireUserId();
  await cancelJoinRequest(userId, requestId);
  revalidatePath("/listas");
};

export const dismissMyRequest = async (requestId: string) => {
  const userId = await requireUserId();
  await dismissJoinOutcome(userId, requestId);
  revalidatePath("/listas");
};
