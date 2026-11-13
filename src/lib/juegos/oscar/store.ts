/**
 * Quiniela del Óscar (FIL-I51): the database side of ballots, closing times and winners. Callers
 * check who is signed in (and `requireAdmin` for winners); these functions validate against the
 * ceremony file and refuse votes once the ballot is closed, in the same statement that writes.
 */
import { and, eq, sql } from "drizzle-orm";
import { db, oscarCeremonies, oscarVotes, oscarWinners } from "@/db";
import { getOscarCeremony } from "@/lib/juegos/oscar/ceremonies";
import {
  findNominee,
  oscarBallotPhase,
  type OscarBallotPhase,
  type OscarCeremonyFile,
} from "@/lib/juegos/oscar/ceremony-core";

/** `timestamp(3)` columns hold UTC; a cast keeps comparisons off the session time zone. */
const utc = (date: Date) => sql`${date.toISOString()}::timestamp`;

export const getOscarClosesAt = async (year: number): Promise<Date | null> => {
  const row = await db.query.oscarCeremonies.findFirst({ where: eq(oscarCeremonies.year, year) });
  return row?.closesAt ?? null;
};

/** Opens (or moves the closing time of) a ceremony's ballots. Admin only: the caller checks. */
export const setOscarClosesAt = async (year: number, closesAt: Date) => {
  if (!getOscarCeremony(year)) {
    throw new Error(`No hay archivo de la entrega ${year}.`);
  }
  await db
    .insert(oscarCeremonies)
    .values({ year, closesAt })
    .onConflictDoUpdate({ target: oscarCeremonies.year, set: { closesAt, updatedAt: new Date() } });
};

export type OscarSeason = {
  year: number;
  ceremony: OscarCeremonyFile | null;
  closesAt: Date | null;
  phase: OscarBallotPhase;
};

export const getOscarSeason = async (year: number, now = new Date()): Promise<OscarSeason> => {
  const ceremony = getOscarCeremony(year);
  const closesAt = ceremony ? await getOscarClosesAt(year) : null;
  return { year, ceremony, closesAt, phase: oscarBallotPhase({ hasCeremony: Boolean(ceremony), closesAt, now }) };
};

// ── Votes ────────────────────────────────────────────────────────────────

export type CastOscarVoteResult =
  | { ok: true; nomineeId: string }
  | { ok: false; reason: "invalida" | "cerrada" };

/**
 * Votes (or changes the vote) in one category. The insert only happens while the ceremony has a
 * closing time in the future, so a vote that arrives after the close is refused even if the page
 * still showed the ballot open.
 */
export const castOscarVote = async (input: {
  userId: string;
  year: number;
  categoryId: string;
  nomineeId: string;
  now?: Date;
}): Promise<CastOscarVoteResult> => {
  const ceremony = getOscarCeremony(input.year);
  if (!ceremony || !findNominee(ceremony, input.categoryId, input.nomineeId)) {
    return { ok: false, reason: "invalida" };
  }
  const now = input.now ?? new Date();
  const rows = await db
    .insert(oscarVotes)
    .select(
      sql`SELECT ${input.userId}, ${input.year}::integer, ${input.categoryId}, ${input.nomineeId}, ${utc(now)}, ${utc(now)}
          WHERE EXISTS (
            SELECT 1 FROM "OscarCeremony" WHERE "year" = ${input.year} AND "closesAt" > ${utc(now)}
          )`,
    )
    .onConflictDoUpdate({
      target: [oscarVotes.userId, oscarVotes.year, oscarVotes.categoryId],
      set: { nomineeId: sql`excluded."nomineeId"`, updatedAt: sql`excluded."updatedAt"` },
    })
    .returning({ nomineeId: oscarVotes.nomineeId });
  return rows[0] ? { ok: true, nomineeId: rows[0].nomineeId } : { ok: false, reason: "cerrada" };
};

/** categoryId → nomineeId of one person's ballot. */
export const getOscarVotes = async (userId: string, year: number): Promise<Record<string, string>> => {
  const rows = await db
    .select({ categoryId: oscarVotes.categoryId, nomineeId: oscarVotes.nomineeId })
    .from(oscarVotes)
    .where(and(eq(oscarVotes.userId, userId), eq(oscarVotes.year, year)));
  return Object.fromEntries(rows.map((row) => [row.categoryId, row.nomineeId]));
};

// ── Winners ──────────────────────────────────────────────────────────────

export type OscarWinnerEntry = { nomineeId: string; announcedAt: Date };

/** categoryId → winner, for the ceremony. */
export const getOscarWinners = async (year: number): Promise<Record<string, OscarWinnerEntry>> => {
  const rows = await db
    .select({
      categoryId: oscarWinners.categoryId,
      nomineeId: oscarWinners.nomineeId,
      announcedAt: oscarWinners.announcedAt,
    })
    .from(oscarWinners)
    .where(eq(oscarWinners.year, year));
  return Object.fromEntries(rows.map((row) => [row.categoryId, { nomineeId: row.nomineeId, announcedAt: row.announcedAt }]));
};

export const winnerIds = (winners: Readonly<Record<string, OscarWinnerEntry>>) =>
  Object.fromEntries(Object.entries(winners).map(([categoryId, entry]) => [categoryId, entry.nomineeId]));

/**
 * Enters or corrects a category's winner. Admin only: the caller checks. A correction keeps the
 * original announcement time, so the live order does not jump.
 */
export const setOscarWinner = async (input: {
  year: number;
  categoryId: string;
  nomineeId: string;
  enteredByUserId: string;
  now?: Date;
}) => {
  const ceremony = getOscarCeremony(input.year);
  if (!ceremony || !findNominee(ceremony, input.categoryId, input.nomineeId)) {
    throw new Error("Esa nominada no está en la entrega.");
  }
  await db
    .insert(oscarWinners)
    .values({
      year: input.year,
      categoryId: input.categoryId,
      nomineeId: input.nomineeId,
      enteredByUserId: input.enteredByUserId,
      announcedAt: input.now ?? new Date(),
    })
    .onConflictDoUpdate({
      target: [oscarWinners.year, oscarWinners.categoryId],
      set: { nomineeId: input.nomineeId, enteredByUserId: input.enteredByUserId },
    });
};

/** Takes a winner back (entered by mistake in the wrong category). Admin only. */
export const clearOscarWinner = async (year: number, categoryId: string) => {
  await db.delete(oscarWinners).where(and(eq(oscarWinners.year, year), eq(oscarWinners.categoryId, categoryId)));
};
