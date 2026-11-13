"use server";

import { oscarSeasonYear } from "@/lib/juegos/oscar/ceremonies";
import { castOscarVote, type CastOscarVoteResult } from "@/lib/juegos/oscar/store";
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
