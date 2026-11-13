/**
 * La noche (FIL-I51-4): one person's live summary of a ceremony and their groups' tables, read fresh
 * on every refresh. Everyone's hits are computed from the winners as they are now, so a corrected
 * winner changes them all on the next read.
 */
import { groupStandings, listMyGroups } from "@/lib/quinielas/groups";
import { getWinners } from "@/lib/quinielas/store";
import { nightSummary, type BallotCategory } from "@/lib/quinielas/view";

const MAX_GROUPS_ON_NIGHT = 3;

export const loadNight = async (
  userId: string,
  ceremonyId: string,
  categories: BallotCategory[],
  votes: Record<string, string>,
) => {
  const [winners, groups] = await Promise.all([getWinners(ceremonyId), listMyGroups(userId, ceremonyId)]);
  const tables = await Promise.all(
    groups.slice(0, MAX_GROUPS_ON_NIGHT).map(async (group) => ({ group, standings: await groupStandings(group, userId) })),
  );
  return { night: nightSummary(categories, votes, winners), groups: tables };
};
