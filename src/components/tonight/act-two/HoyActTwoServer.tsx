import type { Platform } from "@/db";
import { ActTwoActionsProvider } from "@/components/tonight/act-two/ActTwoActions";
import { HoyActTwo } from "@/components/tonight/act-two/HoyActTwo";
import { HoyPeek } from "@/components/tonight/act-two/HoyPeek";
import { getAssignableLists, getUserListMembershipIndex, getUserTmdbIndex } from "@/lib/queries";
import { getRecentArrivals, getServiceCharts } from "@/lib/service-charts-store";
import { chartPlatformsFor } from "@/lib/service-charts";
import { getPinnedTonightTitleId } from "@/lib/tonight-store";

/**
 * Loads Hoy's second act (FIL-I47-1) in its own Suspense boundary, so the sala never waits on it.
 * Database only: the rankings and arrival dates come from the nightly crons.
 */
export const HoyActTwoServer = async ({ userId, userPlatforms }: { userId: string; userPlatforms: Platform[] }) => {
  const now = new Date();
  const [charts, arrivals] = await Promise.all([
    getServiceCharts(userPlatforms),
    getRecentArrivals(userId, userPlatforms, now).catch(() => []),
  ]);
  if (chartPlatformsFor(userPlatforms, charts).length === 0 && arrivals.length === 0) {
    return null;
  }
  const [existing, lists, memberships, pinnedTitleId] = await Promise.all([
    getUserTmdbIndex(),
    getAssignableLists(),
    getUserListMembershipIndex(),
    getPinnedTonightTitleId(userId),
  ]);
  return (
    <ActTwoActionsProvider
      existing={existing}
      lists={lists.map(({ id, name, slug }) => ({ id, name, slug }))}
      memberships={memberships}
      pinnedTitleId={pinnedTitleId}
    >
      <HoyPeek />
      <HoyActTwo userPlatforms={userPlatforms} charts={charts} arrivals={arrivals} now={now.toISOString()} />
    </ActTwoActionsProvider>
  );
};
