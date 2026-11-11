import type { Platform } from "@/db";
import { ActTwoActionsProvider } from "@/components/tonight/act-two/ActTwoActions";
import { HoyActTwo } from "@/components/tonight/act-two/HoyActTwo";
import { HoyPeek } from "@/components/tonight/act-two/HoyPeek";
import { getAssignableLists, getUserListMembershipIndex, getUserTmdbIndex } from "@/lib/queries";
import { getRecentArrivals, getServiceCharts } from "@/lib/service-charts-store";
import { actTwoStamp, chartPlatformsFor } from "@/lib/service-charts";
import { getPinnedTonightTitleId } from "@/lib/tonight-store";
import { countUserSignals, loadAfinaCards } from "@/lib/cold-start-store";
import { afinaMode } from "@/lib/tonight/cold-start";

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
  const [existing, lists, memberships, pinnedTitleId, signals] = await Promise.all([
    getUserTmdbIndex(),
    getAssignableLists(),
    getUserListMembershipIndex(),
    getPinnedTonightTitleId(userId),
    countUserSignals(userId).catch(() => null),
  ]);
  // «Afina tu gusto» (FIL-I47-3): only while Hoy knows little (≤ 40 signals).
  const afinaCards =
    signals != null && afinaMode(signals) !== "hidden" ? await loadAfinaCards(userId, userPlatforms).catch(() => []) : [];
  return (
    <ActTwoActionsProvider
      existing={existing}
      lists={lists.map(({ id, name, slug }) => ({ id, name, slug }))}
      memberships={memberships}
      pinnedTitleId={pinnedTitleId}
    >
      <HoyPeek />
      <HoyActTwo
        userPlatforms={userPlatforms}
        charts={charts}
        arrivals={arrivals}
        now={now.toISOString()}
        stamp={actTwoStamp(charts, arrivals)}
        afina={signals != null && afinaCards.length > 0 ? { cards: afinaCards, signals } : null}
      />
    </ActTwoActionsProvider>
  );
};
