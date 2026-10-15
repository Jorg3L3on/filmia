import { eq } from "drizzle-orm";
import { db, users } from "@/db";
import { isSessionVersionCurrent } from "@/lib/auth/session-token";

/** The account's current `sessionVersion`, or null when the account no longer exists. */
export const loadSessionVersion = async (userId: string) => {
  const row = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { sessionVersion: true },
  });
  return row ? row.sessionVersion : null;
};

/**
 * Whether a verified token still belongs to a live session. Fails open (and logs) when the
 * database is unreachable: every protected page reads it too, so nothing is served anyway.
 */
export const isSessionCurrent = async (session: { id: string; sessionVersion: number }) => {
  try {
    return isSessionVersionCurrent(session.sessionVersion, await loadSessionVersion(session.id));
  } catch (error) {
    console.error("[auth] session version check failed", error);
    return true;
  }
};
