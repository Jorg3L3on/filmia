/**
 * Quinielas de premios (FIL-I51): the database side of ballots, closing times and winners, per
 * ceremony (`oscar-2027`). Callers check who is signed in (and `isAdmin` for winners); these
 * functions validate against the ceremony file and refuse votes once the ballot is closed, in the
 * same statement that writes.
 */
import { and, eq, sql } from "drizzle-orm";
import { db, quinielaCeremonies, quinielaVotes, quinielaWinners } from "@/db";
import { getCeremony } from "@/lib/quinielas/ceremonies";
import { ballotPhase, findNominee, type QuinielaBallotPhase, type QuinielaCeremonyFile } from "@/lib/quinielas/ceremony-core";

/** `timestamp(3)` columns hold UTC; a cast keeps comparisons off the session time zone. */
const utc = (date: Date) => sql`${date.toISOString()}::timestamp`;

export const getClosesAt = async (ceremonyId: string): Promise<Date | null> => {
  const row = await db.query.quinielaCeremonies.findFirst({ where: eq(quinielaCeremonies.ceremonyId, ceremonyId) });
  return row?.closesAt ?? null;
};

/** Closing times of every ceremony that has one (the hub). */
export const getClosingTimes = async (): Promise<Record<string, Date>> => {
  const rows = await db.select().from(quinielaCeremonies);
  return Object.fromEntries(rows.map((row) => [row.ceremonyId, row.closesAt]));
};

/** Opens (or moves the closing time of) a ceremony's ballots. Admin only: the caller checks. */
export const setClosesAt = async (ceremonyId: string, closesAt: Date) => {
  if (!getCeremony(ceremonyId)) {
    throw new Error(`No hay archivo de la entrega ${ceremonyId}.`);
  }
  await db
    .insert(quinielaCeremonies)
    .values({ ceremonyId, closesAt })
    .onConflictDoUpdate({ target: quinielaCeremonies.ceremonyId, set: { closesAt, updatedAt: new Date() } });
};

export type QuinielaSeason = {
  ceremony: QuinielaCeremonyFile | null;
  closesAt: Date | null;
  phase: QuinielaBallotPhase;
};

export const getSeason = async (ceremonyId: string, now = new Date()): Promise<QuinielaSeason> => {
  const ceremony = getCeremony(ceremonyId);
  const closesAt = ceremony ? await getClosesAt(ceremonyId) : null;
  return { ceremony, closesAt, phase: ballotPhase({ hasCeremony: Boolean(ceremony), closesAt, now }) };
};

// ── Votes ────────────────────────────────────────────────────────────────

export type CastVoteResult = { ok: true; nomineeId: string } | { ok: false; reason: "invalida" | "cerrada" };

/**
 * Votes (or changes the vote) in one category. The insert only happens while the ceremony has a
 * closing time in the future, so a vote that arrives after the close is refused even if the page
 * still showed the ballot open.
 */
export const castVote = async (input: {
  userId: string;
  ceremonyId: string;
  categoryId: string;
  nomineeId: string;
  now?: Date;
}): Promise<CastVoteResult> => {
  const ceremony = getCeremony(input.ceremonyId);
  if (!ceremony || !findNominee(ceremony, input.categoryId, input.nomineeId)) {
    return { ok: false, reason: "invalida" };
  }
  const now = input.now ?? new Date();
  const rows = await db
    .insert(quinielaVotes)
    .select(
      sql`SELECT ${input.userId}, ${input.ceremonyId}, ${input.categoryId}, ${input.nomineeId}, ${utc(now)}, ${utc(now)}
          WHERE EXISTS (
            SELECT 1 FROM "QuinielaCeremony" WHERE "ceremonyId" = ${input.ceremonyId} AND "closesAt" > ${utc(now)}
          )`,
    )
    .onConflictDoUpdate({
      target: [quinielaVotes.userId, quinielaVotes.ceremonyId, quinielaVotes.categoryId],
      set: { nomineeId: sql`excluded."nomineeId"`, updatedAt: sql`excluded."updatedAt"` },
    })
    .returning({ nomineeId: quinielaVotes.nomineeId });
  return rows[0] ? { ok: true, nomineeId: rows[0].nomineeId } : { ok: false, reason: "cerrada" };
};

/** categoryId → nomineeId of one person's ballot. */
export const getVotes = async (userId: string, ceremonyId: string): Promise<Record<string, string>> => {
  const rows = await db
    .select({ categoryId: quinielaVotes.categoryId, nomineeId: quinielaVotes.nomineeId })
    .from(quinielaVotes)
    .where(and(eq(quinielaVotes.userId, userId), eq(quinielaVotes.ceremonyId, ceremonyId)));
  return Object.fromEntries(rows.map((row) => [row.categoryId, row.nomineeId]));
};

/** ceremonyId → how many categories this person voted (the hub). */
export const getVoteCounts = async (userId: string): Promise<Record<string, number>> => {
  const rows = await db
    .select({ ceremonyId: quinielaVotes.ceremonyId, count: sql<number>`count(*)::int` })
    .from(quinielaVotes)
    .where(eq(quinielaVotes.userId, userId))
    .groupBy(quinielaVotes.ceremonyId);
  return Object.fromEntries(rows.map((row) => [row.ceremonyId, row.count]));
};

// ── Winners ──────────────────────────────────────────────────────────────

export type WinnerEntry = { nomineeId: string; announcedAt: Date };

/** categoryId → winner, for the ceremony. */
export const getWinners = async (ceremonyId: string): Promise<Record<string, WinnerEntry>> => {
  const rows = await db
    .select({
      categoryId: quinielaWinners.categoryId,
      nomineeId: quinielaWinners.nomineeId,
      announcedAt: quinielaWinners.announcedAt,
    })
    .from(quinielaWinners)
    .where(eq(quinielaWinners.ceremonyId, ceremonyId));
  return Object.fromEntries(rows.map((row) => [row.categoryId, { nomineeId: row.nomineeId, announcedAt: row.announcedAt }]));
};

/** ceremonyId → how many categories have a winner (the hub). */
export const getWinnerCounts = async (): Promise<Record<string, number>> => {
  const rows = await db
    .select({ ceremonyId: quinielaWinners.ceremonyId, count: sql<number>`count(*)::int` })
    .from(quinielaWinners)
    .groupBy(quinielaWinners.ceremonyId);
  return Object.fromEntries(rows.map((row) => [row.ceremonyId, row.count]));
};

export const winnerIds = (winners: Readonly<Record<string, WinnerEntry>>) =>
  Object.fromEntries(Object.entries(winners).map(([categoryId, entry]) => [categoryId, entry.nomineeId]));

/**
 * Enters or corrects a category's winner. Admin only: the caller checks. A correction keeps the
 * original announcement time, so the live order does not jump.
 */
export const setWinner = async (input: {
  ceremonyId: string;
  categoryId: string;
  nomineeId: string;
  enteredByUserId: string;
  now?: Date;
}) => {
  const ceremony = getCeremony(input.ceremonyId);
  if (!ceremony || !findNominee(ceremony, input.categoryId, input.nomineeId)) {
    throw new Error("Esa nominada no está en la entrega.");
  }
  await db
    .insert(quinielaWinners)
    .values({
      ceremonyId: input.ceremonyId,
      categoryId: input.categoryId,
      nomineeId: input.nomineeId,
      enteredByUserId: input.enteredByUserId,
      announcedAt: input.now ?? new Date(),
    })
    .onConflictDoUpdate({
      target: [quinielaWinners.ceremonyId, quinielaWinners.categoryId],
      set: { nomineeId: input.nomineeId, enteredByUserId: input.enteredByUserId },
    });
};

/** Takes a winner back (entered by mistake in the wrong category). Admin only. */
export const clearWinner = async (ceremonyId: string, categoryId: string) => {
  await db
    .delete(quinielaWinners)
    .where(and(eq(quinielaWinners.ceremonyId, ceremonyId), eq(quinielaWinners.categoryId, categoryId)));
};
