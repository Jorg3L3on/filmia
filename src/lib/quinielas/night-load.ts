/**
 * La noche del Óscar (FIL-I51-4): one person's live summary and their groups' tables, read fresh on
 * every refresh. Everyone's hits are computed from the winners as they are now, so a corrected
 * winner changes them all on the next read.
 */
import type { BallotCategory } from "@/lib/quinielas/view";
import { oscarNightSummary } from "@/lib/quinielas/view";
import { listMyOscarGroups, oscarGroupStandings } from "@/lib/quinielas/groups";
import { getOscarWinners } from "@/lib/quinielas/store";

const MAX_GROUPS_ON_NIGHT = 3;

export const loadOscarNight = async (
  userId: string,
  year: number,
  categories: BallotCategory[],
  votes: Record<string, string>,
) => {
  const [winners, groups] = await Promise.all([getOscarWinners(year), listMyOscarGroups(userId, year)]);
  const tables = await Promise.all(
    groups.slice(0, MAX_GROUPS_ON_NIGHT).map(async (group) => ({ group, standings: await oscarGroupStandings(group, userId) })),
  );
  return { night: oscarNightSummary(categories, votes, winners), groups: tables };
};
