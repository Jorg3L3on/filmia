import { createId } from "@paralleldrive/cuid2";
import { and, asc, count, desc, eq, gt, inArray, isNull, lt, ne, or, sql } from "drizzle-orm";
import {
  catalog,
  db,
  listInvites,
  listItems,
  listJoinRequests,
  listMembers,
  lists,
  pushSubscriptions,
  users,
  type ListInviteKind,
  type ListInviteRow,
  type ListRole,
} from "@/db";
import { scheduleAfterResponse } from "@/lib/after-response";
import { listAccessFor } from "@/lib/list-access";
import { shareableRoles } from "@/lib/list-access-core";
import {
  draftInvite,
  generateInviteToken,
  hashInviteToken,
  inviteStatus,
  inviteUsable,
  isPlausibleInviteToken,
  nextJoinRequestStatus,
  type JoinDecision,
} from "@/lib/list-invites-core";
import { isPushConfigured, sendPush } from "@/lib/push/web-push";

/**
 * The database side of list sharing (FIL-I18-3): links, join requests and
 * members. Callers check the caller's role first (`requireListAccess`); the
 * writes here still scope every update to the list so a stray id does nothing.
 */

// ── Links ────────────────────────────────────────────────────────────────

export const createListInvite = async (input: {
  listId: string;
  ownerId: string;
  kind: ListInviteKind;
  role: ListRole;
  groupMaxUses?: unknown;
  list: { kind: Parameters<typeof shareableRoles>[0]["kind"]; slug: string | null };
}) => {
  const allowed = shareableRoles(input.list);
  if (!allowed.includes(input.role)) {
    throw new Error(
      allowed.length === 0 ? "Esta lista no se puede compartir." : "Favoritas solo se comparte para ver.",
    );
  }
  const token = generateInviteToken();
  const draft = draftInvite(input.kind, input.role, input.groupMaxUses);
  const [invite] = await db
    .insert(listInvites)
    .values({
      id: createId(),
      listId: input.listId,
      tokenHash: hashInviteToken(token),
      createdByUserId: input.ownerId,
      ...draft,
    })
    .returning();
  return { token, invite: invite! };
};

export const getListInvites = async (listId: string) => {
  const rows = await db
    .select()
    .from(listInvites)
    .where(eq(listInvites.listId, listId))
    .orderBy(desc(listInvites.createdAt));
  const now = new Date();
  return rows.map((invite) => ({ ...invite, status: inviteStatus(invite, now) }));
};

/** Off (revoke a personal link, pause a group one) or back on (group links only). */
export const setInviteDisabled = async (listId: string, inviteId: string, disabled: boolean) => {
  await db
    .update(listInvites)
    .set({ disabledAt: disabled ? new Date() : null })
    .where(
      and(
        eq(listInvites.id, inviteId),
        eq(listInvites.listId, listId),
        // A personal link stays revoked: the owner makes a new one instead.
        disabled ? undefined : eq(listInvites.kind, "GROUP"),
      ),
    );
};

const findInviteByToken = async (token: string): Promise<ListInviteRow | null> => {
  if (!isPlausibleInviteToken(token)) {
    return null;
  }
  const [invite] = await db
    .select()
    .from(listInvites)
    .where(eq(listInvites.tokenHash, hashInviteToken(token)))
    .limit(1);
  return invite ?? null;
};

/**
 * Takes one use of the link, or nothing. Two people opening the same personal
 * link at once: Postgres serialises the row update and re-checks the WHERE,
 * so only one gets a row back.
 */
const consumeInvite = async (inviteId: string) => {
  const [row] = await db
    .update(listInvites)
    .set({ usedCount: sql`${listInvites.usedCount} + 1` })
    .where(
      and(
        eq(listInvites.id, inviteId),
        isNull(listInvites.disabledAt),
        or(isNull(listInvites.expiresAt), gt(listInvites.expiresAt, new Date())),
        lt(listInvites.usedCount, listInvites.maxUses),
      ),
    )
    .returning({ id: listInvites.id });
  return Boolean(row);
};

const PREVIEW_POSTERS = 4;

/**
 * What `/unirse/[token]` shows before anyone joins: the list, its owner's
 * name and a few posters. Null when the link does not work, whatever the
 * reason (unknown, expired, used up, off).
 */
export const getInvitePreview = async (token: string) => {
  const invite = await findInviteByToken(token);
  if (!invite || !inviteUsable(invite)) {
    return null;
  }
  const [head] = await db
    .select({
      id: lists.id,
      name: lists.name,
      description: lists.description,
      requireApproval: lists.requireApproval,
      ownerId: lists.userId,
      ownerName: users.name,
    })
    .from(lists)
    .innerJoin(users, eq(users.id, lists.userId))
    .where(eq(lists.id, invite.listId))
    .limit(1);
  if (!head) {
    return null;
  }
  const [posters, [counted]] = await Promise.all([
    db
      .select({ posterPath: catalog.posterPath, name: catalog.name })
      .from(listItems)
      .innerJoin(catalog, eq(catalog.id, listItems.catalogId))
      .where(eq(listItems.listId, head.id))
      .orderBy(asc(listItems.position))
      .limit(PREVIEW_POSTERS),
    db.select({ total: count() }).from(listItems).where(eq(listItems.listId, head.id)),
  ]);
  return {
    invite: { id: invite.id, kind: invite.kind, role: invite.role },
    list: { ...head, total: counted?.total ?? 0, posters },
  };
};

export type InvitePreview = NonNullable<Awaited<ReturnType<typeof getInvitePreview>>>;

// ── Joining ──────────────────────────────────────────────────────────────

export type JoinOutcome =
  | { status: "member"; listId: string }
  | { status: "joined"; listId: string }
  | { status: "requested"; listId: string }
  | { status: "pending"; listId: string }
  | { status: "unavailable" };

export const pendingRequestOf = async (listId: string, userId: string) => {
  const [row] = await db
    .select({ id: listJoinRequests.id })
    .from(listJoinRequests)
    .where(
      and(
        eq(listJoinRequests.listId, listId),
        eq(listJoinRequests.userId, userId),
        eq(listJoinRequests.status, "PENDING"),
      ),
    )
    .limit(1);
  return row ?? null;
};

/**
 * «Solicitar unirme». Owners and members just go to the list; a pending
 * request stays as it is (no second row, no second use of the link).
 * Otherwise one use of the link buys a request the owner approves, or a
 * membership straight away when the list does not ask for approval.
 */
export const requestToJoin = async (userId: string, token: string): Promise<JoinOutcome> => {
  const invite = await findInviteByToken(token);
  if (!invite) {
    return { status: "unavailable" };
  }
  const listId = invite.listId;
  if (await listAccessFor(listId, userId)) {
    return { status: "member", listId };
  }
  if (await pendingRequestOf(listId, userId)) {
    return { status: "pending", listId };
  }
  if (!inviteUsable(invite)) {
    return { status: "unavailable" };
  }

  const list = await db.query.lists.findFirst({
    where: eq(lists.id, listId),
    columns: { id: true, name: true, userId: true, requireApproval: true },
  });
  if (!list) {
    return { status: "unavailable" };
  }

  // The row first, the link's use after: a double tap creates one row and
  // spends one use; if the link ran out meanwhile, the row is taken back.
  if (!list.requireApproval) {
    const joined = await db
      .insert(listMembers)
      .values({ listId, userId, role: invite.role })
      .onConflictDoNothing()
      .returning({ userId: listMembers.userId });
    if (joined.length === 0) {
      return { status: "member", listId };
    }
    if (!(await consumeInvite(invite.id))) {
      await db
        .delete(listMembers)
        .where(and(eq(listMembers.listId, listId), eq(listMembers.userId, userId)));
      return { status: "unavailable" };
    }
    return { status: "joined", listId };
  }

  const [created] = await db
    .insert(listJoinRequests)
    .values({ id: createId(), listId, userId, inviteId: invite.id, role: invite.role })
    .onConflictDoNothing()
    .returning({ id: listJoinRequests.id });
  if (!created) {
    return { status: "pending", listId };
  }
  if (!(await consumeInvite(invite.id))) {
    await db.delete(listJoinRequests).where(eq(listJoinRequests.id, created.id));
    return { status: "unavailable" };
  }
  scheduleAfterResponse(() => notifyOwnerOfRequest(list, userId));
  return { status: "requested", listId };
};

/** «Ana quiere unirse a Thrillers del finde», when the owner allowed notifications. */
const notifyOwnerOfRequest = async (list: { id: string; name: string; userId: string }, requesterId: string) => {
  if (!isPushConfigured()) {
    return;
  }
  const [requester, subscriptions] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, requesterId), columns: { name: true } }),
    db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, list.userId)),
  ]);
  const who = requester?.name?.trim() || "Alguien";
  const gone: string[] = [];
  for (const subscription of subscriptions) {
    const outcome = await sendPush(subscription, {
      title: `${who} quiere unirse`,
      body: `a «${list.name}». Toca para aprobar.`,
      url: `/listas/${list.id}/miembros`,
      tag: `list-request-${list.id}`,
    });
    if (outcome === "gone") {
      gone.push(subscription.id);
    }
  }
  if (gone.length > 0) {
    await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.id, gone));
  }
};

/**
 * Owner's call on a request. Approving writes the status and the membership
 * in one batch (atomic on neon-http); the membership is copied from the
 * request row only once it reads APPROVED, so a second click does nothing.
 */
export const decideJoinRequest = async (
  listId: string,
  ownerId: string,
  requestIds: readonly string[],
  decision: Exclude<JoinDecision, "cancel">,
) => {
  const next = nextJoinRequestStatus("PENDING", decision)!;
  if (requestIds.length === 0) {
    return 0;
  }
  const now = new Date();
  const scope = and(
    inArray(listJoinRequests.id, [...requestIds]),
    eq(listJoinRequests.listId, listId),
  );
  const update = db
    .update(listJoinRequests)
    .set({ status: next, decidedAt: now, decidedByUserId: ownerId })
    .where(and(scope, eq(listJoinRequests.status, "PENDING")))
    .returning({ id: listJoinRequests.id });

  if (decision === "reject") {
    const rows = await update;
    return rows.length;
  }

  const [rows] = await db.batch([
    update,
    db
      .insert(listMembers)
      .select(
        db
          .select({
            listId: listJoinRequests.listId,
            userId: listJoinRequests.userId,
            role: listJoinRequests.role,
            joinedAt: sql<Date>`now()`.as("joinedAt"),
          })
          .from(listJoinRequests)
          .where(and(scope, eq(listJoinRequests.status, "APPROVED"), eq(listJoinRequests.decidedAt, now))),
      )
      .onConflictDoNothing(),
  ]);
  return rows.length;
};

export const cancelJoinRequest = async (userId: string, requestId: string) => {
  await db
    .update(listJoinRequests)
    .set({ status: nextJoinRequestStatus("PENDING", "cancel")!, decidedAt: new Date() })
    .where(
      and(
        eq(listJoinRequests.id, requestId),
        eq(listJoinRequests.userId, userId),
        eq(listJoinRequests.status, "PENDING"),
      ),
    );
};

/** The requester saw «no se pudo»: it leaves «Compartidas conmigo». */
export const dismissJoinOutcome = async (userId: string, requestId: string) => {
  await db
    .update(listJoinRequests)
    .set({ seenAt: new Date() })
    .where(
      and(
        eq(listJoinRequests.id, requestId),
        eq(listJoinRequests.userId, userId),
        eq(listJoinRequests.status, "REJECTED"),
      ),
    );
};

// ── Members ──────────────────────────────────────────────────────────────

/**
 * Who is on the list, owner first: name only (never email, ratings or diary).
 * Plus how many films each one added.
 */
export const getListPeople = async (listId: string) => {
  const list = await db.query.lists.findFirst({
    where: eq(lists.id, listId),
    columns: { userId: true },
  });
  if (!list) {
    return [];
  }
  const [owner, members, added] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, list.userId), columns: { id: true, name: true } }),
    db
      .select({ id: users.id, name: users.name, role: listMembers.role, joinedAt: listMembers.joinedAt })
      .from(listMembers)
      .innerJoin(users, eq(users.id, listMembers.userId))
      .where(eq(listMembers.listId, listId))
      .orderBy(asc(listMembers.joinedAt)),
    db
      .select({ userId: listItems.addedByUserId, total: count() })
      .from(listItems)
      .where(eq(listItems.listId, listId))
      .groupBy(listItems.addedByUserId),
  ]);
  const addedBy = new Map(added.map((row) => [row.userId, row.total]));
  return [
    ...(owner
      ? [{ id: owner.id, name: owner.name, role: "OWNER" as const, joinedAt: null, added: addedBy.get(owner.id) ?? 0 }]
      : []),
    ...members.map((member) => ({ ...member, added: addedBy.get(member.id) ?? 0 })),
  ];
};

export type ListPerson = Awaited<ReturnType<typeof getListPeople>>[number];

export const getPendingRequests = async (listId: string) =>
  db
    .select({
      id: listJoinRequests.id,
      userId: listJoinRequests.userId,
      name: users.name,
      role: listJoinRequests.role,
      createdAt: listJoinRequests.createdAt,
    })
    .from(listJoinRequests)
    .innerJoin(users, eq(users.id, listJoinRequests.userId))
    .where(and(eq(listJoinRequests.listId, listId), eq(listJoinRequests.status, "PENDING")))
    .orderBy(asc(listJoinRequests.createdAt));

/** Pending requests on every list the user owns (the badge on Listas). */
export const countPendingRequestsForOwner = async (ownerId: string) => {
  const [row] = await db
    .select({ total: count() })
    .from(listJoinRequests)
    .innerJoin(lists, eq(lists.id, listJoinRequests.listId))
    .where(and(eq(lists.userId, ownerId), eq(listJoinRequests.status, "PENDING")));
  return row?.total ?? 0;
};

export const setMemberRole = async (listId: string, memberId: string, role: ListRole) => {
  await db
    .update(listMembers)
    .set({ role })
    .where(and(eq(listMembers.listId, listId), eq(listMembers.userId, memberId)));
};

/** Taking someone out (or leaving): their films stay, still signed with their name. */
export const removeMember = async (listId: string, memberId: string) => {
  await db
    .delete(listMembers)
    .where(and(eq(listMembers.listId, listId), eq(listMembers.userId, memberId)));
};

// ── «Compartidas conmigo» ────────────────────────────────────────────────

/**
 * Lists shared with the user (not theirs), with owner name and size, plus
 * requests still waiting and refusals they have not seen yet.
 */
export const getSharedWithMe = async (userId: string) => {
  const [memberships, requests] = await Promise.all([
    db
      .select({
        id: lists.id,
        name: lists.name,
        role: listMembers.role,
        ownerId: lists.userId,
        ownerName: users.name,
        joinedAt: listMembers.joinedAt,
      })
      .from(listMembers)
      .innerJoin(lists, eq(lists.id, listMembers.listId))
      .innerJoin(users, eq(users.id, lists.userId))
      .where(and(eq(listMembers.userId, userId), ne(lists.userId, userId)))
      .orderBy(desc(listMembers.joinedAt)),
    db
      .select({
        id: listJoinRequests.id,
        listId: lists.id,
        listName: lists.name,
        ownerName: users.name,
        status: listJoinRequests.status,
        createdAt: listJoinRequests.createdAt,
      })
      .from(listJoinRequests)
      .innerJoin(lists, eq(lists.id, listJoinRequests.listId))
      .innerJoin(users, eq(users.id, lists.userId))
      .where(
        and(
          eq(listJoinRequests.userId, userId),
          or(
            eq(listJoinRequests.status, "PENDING"),
            and(eq(listJoinRequests.status, "REJECTED"), isNull(listJoinRequests.seenAt)),
          ),
        ),
      )
      .orderBy(desc(listJoinRequests.createdAt)),
  ]);

  const ids = memberships.map((list) => list.id);
  const [counts, posters] = ids.length
    ? await Promise.all([
        db
          .select({ listId: listItems.listId, total: count() })
          .from(listItems)
          .where(inArray(listItems.listId, ids))
          .groupBy(listItems.listId),
        db
          .select({
            listId: listItems.listId,
            id: catalog.id,
            name: catalog.name,
            posterPath: catalog.posterPath,
            position: listItems.position,
          })
          .from(listItems)
          .innerJoin(catalog, eq(catalog.id, listItems.catalogId))
          .where(inArray(listItems.listId, ids))
          .orderBy(asc(listItems.position)),
      ])
    : [[], []];
  const totals = new Map(counts.map((row) => [row.listId, row.total]));
  return {
    lists: memberships.map((list) => ({
      ...list,
      total: totals.get(list.id) ?? 0,
      posters: posters.filter((poster) => poster.listId === list.id).slice(0, 5),
    })),
    requests,
  };
};

/** Members (not the owner) of each list, oldest first: the avatars on «compartida con N». */
export const getMembersByList = async (listIds: string[]) => {
  const index = new Map<string, Array<{ id: string; name: string | null }>>();
  if (listIds.length === 0) {
    return index;
  }
  const rows = await db
    .select({ listId: listMembers.listId, id: users.id, name: users.name })
    .from(listMembers)
    .innerJoin(users, eq(users.id, listMembers.userId))
    .where(inArray(listMembers.listId, listIds))
    .orderBy(asc(listMembers.joinedAt));
  for (const { listId, ...person } of rows) {
    const people = index.get(listId) ?? [];
    people.push(person);
    index.set(listId, people);
  }
  return index;
};

/** Pending requests per list the user owns: «Ana quiere unirse» on Listas. */
export const getPendingRequestsForOwner = async (ownerId: string) =>
  db
    .select({
      id: listJoinRequests.id,
      listId: lists.id,
      listName: lists.name,
      userId: listJoinRequests.userId,
      name: users.name,
      role: listJoinRequests.role,
      createdAt: listJoinRequests.createdAt,
    })
    .from(listJoinRequests)
    .innerJoin(lists, eq(lists.id, listJoinRequests.listId))
    .innerJoin(users, eq(users.id, listJoinRequests.userId))
    .where(and(eq(lists.userId, ownerId), eq(listJoinRequests.status, "PENDING")))
    .orderBy(asc(listJoinRequests.createdAt));

/** Names of whoever added films, including people no longer on the list. */
export const getPeopleNames = async (ids: string[]) => {
  const unique = [...new Set(ids)];
  if (unique.length === 0) {
    return new Map<string, string | null>();
  }
  const rows = await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, unique));
  return new Map(rows.map((row) => [row.id, row.name]));
};
