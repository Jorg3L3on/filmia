/**
 * Quiniela del Óscar (FIL-I51-3): invite-only groups. A link is the only way in; there is no global
 * table and no list of other people's groups. The group table shows first names and hits, never an
 * email: the queries here never select one.
 */
import { createHash, createHmac } from "node:crypto";
import { createId } from "@paralleldrive/cuid2";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db, oscarGroupMembers, oscarGroups, oscarVotes, users } from "@/db";
import { resolveAuthSecret } from "@/lib/auth/constants";
import { getOscarCeremony } from "@/lib/quinielas/ceremonies";
import { OSCAR_GROUP_NAME_MAX } from "@/lib/quinielas/group-limits";
import { scoreOscarBallot } from "@/lib/quinielas/ceremony-core";
import { getOscarWinners, winnerIds } from "@/lib/quinielas/store";
import { personFirstName } from "@/lib/person-avatar";

const MAX_GROUPS_PER_OWNER = 10;
const MAX_MEMBERS = 50;

/** The group's link token: 32 base64url characters, derived so the owner can show it again. */
export const oscarGroupToken = (groupId: string, version: number, secret = resolveAuthSecret()) => {
  if (!secret) {
    throw new Error("AUTH_SECRET no está configurado.");
  }
  return createHmac("sha256", secret).update(`filmia-quiniela:v1:${groupId}:${version}`).digest("base64url").slice(0, 32);
};

export const hashOscarGroupToken = (token: string) => createHash("sha256").update(token).digest("hex");

export const isPlausibleOscarGroupToken = (token: string) => /^[A-Za-z0-9_-]{32}$/.test(token);

export const oscarGroupPath = (token: string) => `/extras/quinielas/unirse/${token}`;

export const cleanGroupName = (raw: unknown, ownerName: string | null) => {
  const name = typeof raw === "string" ? raw.replace(/\s+/g, " ").trim().slice(0, OSCAR_GROUP_NAME_MAX) : "";
  return name || `La quiniela de ${personFirstName(ownerName)}`;
};

export type OscarGroupSummary = { id: string; year: number; name: string; ownerId: string; ownerName: string };

const summaryColumns = {
  id: oscarGroups.id,
  year: oscarGroups.year,
  name: oscarGroups.name,
  ownerId: oscarGroups.ownerId,
  ownerName: users.name,
};

const toSummary = (row: { id: string; year: number; name: string; ownerId: string; ownerName: string | null }) => ({
  ...row,
  ownerName: personFirstName(row.ownerName),
});

export const createOscarGroup = async (input: { ownerId: string; year: number; name?: unknown }) => {
  if (!getOscarCeremony(input.year)) {
    throw new Error("Esta entrega no tiene quiniela.");
  }
  const [owned] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(oscarGroups)
    .where(and(eq(oscarGroups.ownerId, input.ownerId), eq(oscarGroups.year, input.year)));
  if ((owned?.count ?? 0) >= MAX_GROUPS_PER_OWNER) {
    throw new Error(`Puedes tener hasta ${MAX_GROUPS_PER_OWNER} grupos por entrega.`);
  }
  const owner = await db.query.users.findFirst({ where: eq(users.id, input.ownerId), columns: { name: true } });
  const id = createId();
  const token = oscarGroupToken(id, 1);
  await db.batch([
    db.insert(oscarGroups).values({
      id,
      year: input.year,
      ownerId: input.ownerId,
      name: cleanGroupName(input.name, owner?.name ?? null),
      tokenHash: hashOscarGroupToken(token),
      tokenVersion: 1,
    }),
    db.insert(oscarGroupMembers).values({ groupId: id, userId: input.ownerId }),
  ]);
  return { id, token };
};

/** The group a link opens, or null for a malformed, unknown or regenerated token. */
export const getOscarGroupByToken = async (token: string): Promise<OscarGroupSummary | null> => {
  if (!isPlausibleOscarGroupToken(token)) {
    return null;
  }
  const [row] = await db
    .select(summaryColumns)
    .from(oscarGroups)
    .innerJoin(users, eq(users.id, oscarGroups.ownerId))
    .where(eq(oscarGroups.tokenHash, hashOscarGroupToken(token)));
  return row ? toSummary(row) : null;
};

export const isOscarGroupMember = async (groupId: string, userId: string) =>
  Boolean(
    await db.query.oscarGroupMembers.findFirst({
      where: and(eq(oscarGroupMembers.groupId, groupId), eq(oscarGroupMembers.userId, userId)),
      columns: { groupId: true },
    }),
  );

export type JoinOscarGroupResult = { ok: true; groupId: string } | { ok: false; reason: "enlace" | "lleno" };

/** Enters the group a valid link opens; already a member is fine. */
export const joinOscarGroup = async (token: string, userId: string): Promise<JoinOscarGroupResult> => {
  const group = await getOscarGroupByToken(token);
  if (!group) {
    return { ok: false, reason: "enlace" };
  }
  if (!(await isOscarGroupMember(group.id, userId))) {
    const [members] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(oscarGroupMembers)
      .where(eq(oscarGroupMembers.groupId, group.id));
    if ((members?.count ?? 0) >= MAX_MEMBERS) {
      return { ok: false, reason: "lleno" };
    }
    await db.insert(oscarGroupMembers).values({ groupId: group.id, userId }).onConflictDoNothing();
  }
  return { ok: true, groupId: group.id };
};

/** The group, only for its members (null otherwise: the page answers 404). */
export const getOscarGroupForMember = async (groupId: string, userId: string): Promise<OscarGroupSummary | null> => {
  if (typeof groupId !== "string" || groupId.length > 40 || !(await isOscarGroupMember(groupId, userId))) {
    return null;
  }
  const [row] = await db
    .select(summaryColumns)
    .from(oscarGroups)
    .innerJoin(users, eq(users.id, oscarGroups.ownerId))
    .where(eq(oscarGroups.id, groupId));
  return row ? toSummary(row) : null;
};

/**
 * The owner's link to share. If AUTH_SECRET changed since it was made, the stored hash no longer
 * matches and is rewritten, so the link shown always works.
 */
export const ownerOscarGroupLink = async (groupId: string, ownerId: string) => {
  const group = await db.query.oscarGroups.findFirst({
    where: and(eq(oscarGroups.id, groupId), eq(oscarGroups.ownerId, ownerId)),
    columns: { id: true, tokenHash: true, tokenVersion: true },
  });
  if (!group) {
    return null;
  }
  const token = oscarGroupToken(group.id, group.tokenVersion);
  const hash = hashOscarGroupToken(token);
  if (hash !== group.tokenHash) {
    await db.update(oscarGroups).set({ tokenHash: hash }).where(eq(oscarGroups.id, group.id));
  }
  return oscarGroupPath(token);
};

/** «Nuevo enlace»: the old link stops working. Owner only. */
export const regenerateOscarGroupLink = async (groupId: string, ownerId: string) => {
  const group = await db.query.oscarGroups.findFirst({
    where: and(eq(oscarGroups.id, groupId), eq(oscarGroups.ownerId, ownerId)),
    columns: { id: true, tokenVersion: true },
  });
  if (!group) {
    return null;
  }
  const version = group.tokenVersion + 1;
  const token = oscarGroupToken(group.id, version);
  await db
    .update(oscarGroups)
    .set({ tokenVersion: version, tokenHash: hashOscarGroupToken(token) })
    .where(eq(oscarGroups.id, group.id));
  return oscarGroupPath(token);
};

/** A member leaves. The owner cannot leave their own group: they delete it. */
export const leaveOscarGroup = async (groupId: string, userId: string) => {
  const group = await db.query.oscarGroups.findFirst({ where: eq(oscarGroups.id, groupId), columns: { ownerId: true } });
  if (!group || group.ownerId === userId) {
    return false;
  }
  await db
    .delete(oscarGroupMembers)
    .where(and(eq(oscarGroupMembers.groupId, groupId), eq(oscarGroupMembers.userId, userId)));
  return true;
};

export const deleteOscarGroup = async (groupId: string, ownerId: string) => {
  const deleted = await db
    .delete(oscarGroups)
    .where(and(eq(oscarGroups.id, groupId), eq(oscarGroups.ownerId, ownerId)))
    .returning({ id: oscarGroups.id });
  return deleted.length > 0;
};

/** The person's groups for a ceremony, newest first. */
export const listMyOscarGroups = async (userId: string, year: number) =>
  (
    await db
      .select(summaryColumns)
      .from(oscarGroupMembers)
      .innerJoin(oscarGroups, eq(oscarGroups.id, oscarGroupMembers.groupId))
      .innerJoin(users, eq(users.id, oscarGroups.ownerId))
      .where(and(eq(oscarGroupMembers.userId, userId), eq(oscarGroups.year, year)))
      .orderBy(asc(oscarGroups.createdAt))
  ).map(toSummary);

export type OscarGroupStanding = {
  /** Only to mark «Tú»; the page never prints it. */
  isYou: boolean;
  isOwner: boolean;
  name: string;
  hits: number;
  voted: number;
};

/**
 * The group's table: first name, categories voted and hits so far, best first. Picks stay private
 * (no one sees another member's ballot), and there is no email anywhere in it.
 */
export const oscarGroupStandings = async (
  group: Pick<OscarGroupSummary, "id" | "year" | "ownerId">,
  viewerId: string,
): Promise<OscarGroupStanding[]> => {
  const ceremony = getOscarCeremony(group.year);
  const members = await db
    .select({ userId: oscarGroupMembers.userId, name: users.name, joinedAt: oscarGroupMembers.joinedAt })
    .from(oscarGroupMembers)
    .innerJoin(users, eq(users.id, oscarGroupMembers.userId))
    .where(eq(oscarGroupMembers.groupId, group.id))
    .orderBy(asc(oscarGroupMembers.joinedAt));
  if (!ceremony || members.length === 0) {
    return [];
  }
  const ids = members.map((member) => member.userId);
  const [votes, winners] = await Promise.all([
    db
      .select({ userId: oscarVotes.userId, categoryId: oscarVotes.categoryId, nomineeId: oscarVotes.nomineeId })
      .from(oscarVotes)
      .where(and(eq(oscarVotes.year, group.year), inArray(oscarVotes.userId, ids))),
    getOscarWinners(group.year),
  ]);
  const categoryIds = ceremony.categories.map((category) => category.id);
  const won = winnerIds(winners);
  return members
    .map((member) => {
      const ballot = Object.fromEntries(
        votes.filter((vote) => vote.userId === member.userId).map((vote) => [vote.categoryId, vote.nomineeId]),
      );
      const score = scoreOscarBallot(categoryIds, ballot, won);
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
