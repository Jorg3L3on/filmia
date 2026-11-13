/**
 * Quinielas de premios (FIL-I51-3): invite-only groups, one per ceremony (Jorge: a group does not
 * carry over to the next award). A link is the only way in; there is no global table and no list of
 * other people's groups. Members see each other's first names, hits and ballots (FIL-I51-13: being
 * in the group means sharing your ballot with it, at any time), never an email: the queries here
 * never select one.
 */
import { createHash, createHmac } from "node:crypto";
import { createId } from "@paralleldrive/cuid2";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db, quinielaGroupMembers, quinielaGroups, quinielaVotes, users } from "@/db";
import { resolveAuthSecret } from "@/lib/auth/constants";
import { getCeremony } from "@/lib/quinielas/ceremonies";
import { scoreBallot } from "@/lib/quinielas/ceremony-core";
import { QUINIELA_GROUP_NAME_MAX } from "@/lib/quinielas/group-limits";
import { getWinners, winnerIds } from "@/lib/quinielas/store";
import { personFirstName } from "@/lib/person-avatar";

const MAX_GROUPS_PER_OWNER = 10;
const MAX_MEMBERS = 50;

/** The group's link token: 32 base64url characters, derived so the owner can show it again. */
export const groupToken = (groupId: string, version: number, secret = resolveAuthSecret()) => {
  if (!secret) {
    throw new Error("AUTH_SECRET no está configurado.");
  }
  return createHmac("sha256", secret).update(`filmia-quiniela:v1:${groupId}:${version}`).digest("base64url").slice(0, 32);
};

export const hashGroupToken = (token: string) => createHash("sha256").update(token).digest("hex");

export const isPlausibleGroupToken = (token: string) => /^[A-Za-z0-9_-]{32}$/.test(token);

export const groupInvitePath = (token: string) => `/extras/quinielas/unirse/${token}`;

export const cleanGroupName = (raw: unknown, ownerName: string | null) => {
  const name = typeof raw === "string" ? raw.replace(/\s+/g, " ").trim().slice(0, QUINIELA_GROUP_NAME_MAX) : "";
  return name || `La quiniela de ${personFirstName(ownerName)}`;
};

export type GroupSummary = { id: string; ceremonyId: string; name: string; ownerId: string; ownerName: string };

const summaryColumns = {
  id: quinielaGroups.id,
  ceremonyId: quinielaGroups.ceremonyId,
  name: quinielaGroups.name,
  ownerId: quinielaGroups.ownerId,
  ownerName: users.name,
};

const toSummary = (row: { id: string; ceremonyId: string; name: string; ownerId: string; ownerName: string | null }) => ({
  ...row,
  ownerName: personFirstName(row.ownerName),
});

export const createGroup = async (input: { ownerId: string; ceremonyId: string; name?: unknown }) => {
  if (!getCeremony(input.ceremonyId)) {
    throw new Error("Esta entrega no tiene quiniela.");
  }
  const [owned] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(quinielaGroups)
    .where(and(eq(quinielaGroups.ownerId, input.ownerId), eq(quinielaGroups.ceremonyId, input.ceremonyId)));
  if ((owned?.count ?? 0) >= MAX_GROUPS_PER_OWNER) {
    throw new Error(`Puedes tener hasta ${MAX_GROUPS_PER_OWNER} grupos por entrega.`);
  }
  const owner = await db.query.users.findFirst({ where: eq(users.id, input.ownerId), columns: { name: true } });
  const id = createId();
  const token = groupToken(id, 1);
  await db.batch([
    db.insert(quinielaGroups).values({
      id,
      ceremonyId: input.ceremonyId,
      ownerId: input.ownerId,
      name: cleanGroupName(input.name, owner?.name ?? null),
      tokenHash: hashGroupToken(token),
      tokenVersion: 1,
    }),
    db.insert(quinielaGroupMembers).values({ groupId: id, userId: input.ownerId }),
  ]);
  return { id, token };
};

/** The group a link opens, or null for a malformed, unknown or regenerated token. */
export const getGroupByToken = async (token: string): Promise<GroupSummary | null> => {
  if (!isPlausibleGroupToken(token)) {
    return null;
  }
  const [row] = await db
    .select(summaryColumns)
    .from(quinielaGroups)
    .innerJoin(users, eq(users.id, quinielaGroups.ownerId))
    .where(eq(quinielaGroups.tokenHash, hashGroupToken(token)));
  return row ? toSummary(row) : null;
};

export const isGroupMember = async (groupId: string, userId: string) =>
  Boolean(
    await db.query.quinielaGroupMembers.findFirst({
      where: and(eq(quinielaGroupMembers.groupId, groupId), eq(quinielaGroupMembers.userId, userId)),
      columns: { groupId: true },
    }),
  );

export type JoinGroupResult = { ok: true; groupId: string } | { ok: false; reason: "enlace" | "lleno" };

/** Enters the group a valid link opens; already a member is fine. */
export const joinGroup = async (token: string, userId: string): Promise<JoinGroupResult> => {
  const group = await getGroupByToken(token);
  if (!group) {
    return { ok: false, reason: "enlace" };
  }
  if (!(await isGroupMember(group.id, userId))) {
    const [members] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(quinielaGroupMembers)
      .where(eq(quinielaGroupMembers.groupId, group.id));
    if ((members?.count ?? 0) >= MAX_MEMBERS) {
      return { ok: false, reason: "lleno" };
    }
    await db.insert(quinielaGroupMembers).values({ groupId: group.id, userId }).onConflictDoNothing();
  }
  return { ok: true, groupId: group.id };
};

/** The group, only for its members (null otherwise: the page answers 404). */
export const getGroupForMember = async (groupId: string, userId: string): Promise<GroupSummary | null> => {
  if (typeof groupId !== "string" || groupId.length > 40 || !(await isGroupMember(groupId, userId))) {
    return null;
  }
  const [row] = await db
    .select(summaryColumns)
    .from(quinielaGroups)
    .innerJoin(users, eq(users.id, quinielaGroups.ownerId))
    .where(eq(quinielaGroups.id, groupId));
  return row ? toSummary(row) : null;
};

/**
 * The owner's link to share. If AUTH_SECRET changed since it was made, the stored hash no longer
 * matches and is rewritten, so the link shown always works.
 */
export const ownerGroupLink = async (groupId: string, ownerId: string) => {
  const group = await db.query.quinielaGroups.findFirst({
    where: and(eq(quinielaGroups.id, groupId), eq(quinielaGroups.ownerId, ownerId)),
    columns: { id: true, tokenHash: true, tokenVersion: true },
  });
  if (!group) {
    return null;
  }
  const token = groupToken(group.id, group.tokenVersion);
  const hash = hashGroupToken(token);
  if (hash !== group.tokenHash) {
    await db.update(quinielaGroups).set({ tokenHash: hash }).where(eq(quinielaGroups.id, group.id));
  }
  return groupInvitePath(token);
};

/** «Nuevo enlace»: the old link stops working. Owner only. */
export const regenerateGroupLink = async (groupId: string, ownerId: string) => {
  const group = await db.query.quinielaGroups.findFirst({
    where: and(eq(quinielaGroups.id, groupId), eq(quinielaGroups.ownerId, ownerId)),
    columns: { id: true, tokenVersion: true },
  });
  if (!group) {
    return null;
  }
  const version = group.tokenVersion + 1;
  const token = groupToken(group.id, version);
  await db
    .update(quinielaGroups)
    .set({ tokenVersion: version, tokenHash: hashGroupToken(token) })
    .where(eq(quinielaGroups.id, group.id));
  return groupInvitePath(token);
};

/** A member leaves. The owner cannot leave their own group: they delete it. */
export const leaveGroup = async (groupId: string, userId: string) => {
  const group = await db.query.quinielaGroups.findFirst({ where: eq(quinielaGroups.id, groupId), columns: { ownerId: true } });
  if (!group || group.ownerId === userId) {
    return false;
  }
  await db
    .delete(quinielaGroupMembers)
    .where(and(eq(quinielaGroupMembers.groupId, groupId), eq(quinielaGroupMembers.userId, userId)));
  return true;
};

/** Deletes a group; returns its ceremony so the caller can go back to it. Owner only. */
export const deleteGroup = async (groupId: string, ownerId: string) => {
  const deleted = await db
    .delete(quinielaGroups)
    .where(and(eq(quinielaGroups.id, groupId), eq(quinielaGroups.ownerId, ownerId)))
    .returning({ ceremonyId: quinielaGroups.ceremonyId });
  return deleted[0]?.ceremonyId ?? null;
};

/** The person's groups for a ceremony, oldest first. */
export const listMyGroups = async (userId: string, ceremonyId: string) =>
  (
    await db
      .select(summaryColumns)
      .from(quinielaGroupMembers)
      .innerJoin(quinielaGroups, eq(quinielaGroups.id, quinielaGroupMembers.groupId))
      .innerJoin(users, eq(users.id, quinielaGroups.ownerId))
      .where(and(eq(quinielaGroupMembers.userId, userId), eq(quinielaGroups.ceremonyId, ceremonyId)))
      .orderBy(asc(quinielaGroups.createdAt))
  ).map(toSummary);

/** Every member (joining order) with their ballot for the group's ceremony. Never an email. */
const memberBallots = async (group: Pick<GroupSummary, "id" | "ceremonyId">) => {
  const members = await db
    .select({ userId: quinielaGroupMembers.userId, name: users.name })
    .from(quinielaGroupMembers)
    .innerJoin(users, eq(users.id, quinielaGroupMembers.userId))
    .where(eq(quinielaGroupMembers.groupId, group.id))
    .orderBy(asc(quinielaGroupMembers.joinedAt));
  if (members.length === 0) {
    return [];
  }
  const votes = await db
    .select({ userId: quinielaVotes.userId, categoryId: quinielaVotes.categoryId, nomineeId: quinielaVotes.nomineeId })
    .from(quinielaVotes)
    .where(
      and(
        eq(quinielaVotes.ceremonyId, group.ceremonyId),
        inArray(
          quinielaVotes.userId,
          members.map((member) => member.userId),
        ),
      ),
    );
  return members.map((member) => ({
    userId: member.userId,
    name: member.name,
    ballot: Object.fromEntries(
      votes.filter((vote) => vote.userId === member.userId).map((vote) => [vote.categoryId, vote.nomineeId]),
    ) as Record<string, string>,
  }));
};

export type GroupBallots = {
  /** «Tú» first, then the rest in joining order. */
  members: { name: string; isYou: boolean }[];
  /** Same order as `members`: categoryId → nomineeId. */
  ballots: Record<string, string>[];
};

/**
 * Everyone's ballot in the group (FIL-I51-13). The caller has checked membership
 * (`getGroupForMember`); visible at any time, also while the ballots are open (Jorge).
 */
export const groupBallots = async (group: Pick<GroupSummary, "id" | "ceremonyId">, viewerId: string): Promise<GroupBallots> => {
  const members = (await memberBallots(group)).sort(
    (a, b) => Number(b.userId === viewerId) - Number(a.userId === viewerId),
  );
  return {
    members: members.map((member) => ({ name: personFirstName(member.name), isYou: member.userId === viewerId })),
    ballots: members.map((member) => member.ballot),
  };
};

export type GroupStanding = {
  /** Only to mark «Tú»; the page never prints it. */
  isYou: boolean;
  isOwner: boolean;
  name: string;
  hits: number;
  voted: number;
};

/**
 * The group's table: first name, categories voted and hits so far, best first. No email anywhere
 * in it; the ballots themselves are in `groupBallots`.
 */
export const groupStandings = async (
  group: Pick<GroupSummary, "id" | "ceremonyId" | "ownerId">,
  viewerId: string,
): Promise<GroupStanding[]> => {
  const ceremony = getCeremony(group.ceremonyId);
  const members = await memberBallots(group);
  if (!ceremony || members.length === 0) {
    return [];
  }
  const categoryIds = ceremony.categories.map((category) => category.id);
  const won = winnerIds(await getWinners(group.ceremonyId));
  return members
    .map((member) => {
      const score = scoreBallot(categoryIds, member.ballot, won);
      return {
        isYou: member.userId === viewerId,
        isOwner: member.userId === group.ownerId,
        name: personFirstName(member.name),
        hits: score.hits,
        voted: score.voted,
      };
    })
    .sort((a, b) => b.hits - a.hits || Number(b.isYou) - Number(a.isYou));
};
