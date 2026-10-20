import { createHash, randomBytes } from "node:crypto";
import type { ListInviteKind, ListJoinRequestStatus, ListRole } from "@/db";
import {
  GROUP_MAX_USES_DEFAULT,
  GROUP_MAX_USES_MAX,
  GROUP_MAX_USES_MIN,
} from "@/lib/list-invite-limits";

/**
 * Share links for lists (FIL-I18-3). Pure: token, hash, rules. The database
 * side (create, consume, join requests) lives in `list-invites.ts`.
 *
 * - PERSONAL: one use, expires in 7 days, can be revoked.
 * - GROUP: up to `maxUses` (2–20, 5 by default), can be switched off and on.
 * Only the sha256 of a token is stored; the link shows it once.
 */

export const PERSONAL_INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export { GROUP_MAX_USES_DEFAULT, GROUP_MAX_USES_MAX, GROUP_MAX_USES_MIN };

/** 32 random bytes, base64url: 43 characters, nothing to guess. */
export const generateInviteToken = () => randomBytes(32).toString("base64url");

export const hashInviteToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** Shape check before touching the database; anything else is simply not a link. */
export const isPlausibleInviteToken = (token: string) => /^[A-Za-z0-9_-]{43}$/.test(token);

export { invitePath } from "@/lib/invite-path";

export const clampGroupMaxUses = (value: unknown) => {
  const parsed = Math.round(Number(value));
  if (!Number.isFinite(parsed)) {
    return GROUP_MAX_USES_DEFAULT;
  }
  return Math.min(GROUP_MAX_USES_MAX, Math.max(GROUP_MAX_USES_MIN, parsed));
};

export type InviteDraft = {
  kind: ListInviteKind;
  role: ListRole;
  maxUses: number;
  expiresAt: Date | null;
};

/** What a new link stores, from what the owner picked. */
export const draftInvite = (
  kind: ListInviteKind,
  role: ListRole,
  groupMaxUses: unknown,
  now = new Date(),
): InviteDraft =>
  kind === "PERSONAL"
    ? { kind, role, maxUses: 1, expiresAt: new Date(now.getTime() + PERSONAL_INVITE_TTL_MS) }
    : { kind, role, maxUses: clampGroupMaxUses(groupMaxUses), expiresAt: null };

export type InviteUsage = {
  expiresAt: Date | null;
  maxUses: number;
  usedCount: number;
  disabledAt: Date | null;
};

/**
 * Whether a link still lets someone in. Invalid, expired, used up and switched
 * off all read the same to the person holding it («Este link ya no sirve»).
 */
export const inviteUsable = (invite: InviteUsage | null | undefined, now = new Date()) =>
  Boolean(
    invite &&
      invite.disabledAt == null &&
      (invite.expiresAt == null || invite.expiresAt.getTime() > now.getTime()) &&
      invite.usedCount < invite.maxUses,
  );

/** What the owner sees about a link in Miembros. */
export const inviteStatus = (invite: InviteUsage, now = new Date()) => {
  if (invite.disabledAt != null) {
    return "off" as const;
  }
  if (invite.expiresAt != null && invite.expiresAt.getTime() <= now.getTime()) {
    return "expired" as const;
  }
  if (invite.usedCount >= invite.maxUses) {
    return "used" as const;
  }
  return "active" as const;
};

export type JoinDecision = "approve" | "reject" | "cancel";

/** Only a pending request moves: the owner approves or rejects, the requester cancels. */
export const nextJoinRequestStatus = (
  current: ListJoinRequestStatus,
  decision: JoinDecision,
): ListJoinRequestStatus | null => {
  if (current !== "PENDING") {
    return null;
  }
  switch (decision) {
    case "approve":
      return "APPROVED";
    case "reject":
      return "REJECTED";
    case "cancel":
      return "CANCELLED";
  }
};
