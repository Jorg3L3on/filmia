import { Suspense } from "react";
import { CineActionsProvider } from "@/components/cine/CineActions";
import { CineMarquee, CineSection, StaleNotice } from "@/components/cine/CineParts";
import { HomeArrivalsRail, NowShowingRail, UpcomingTimeline } from "@/components/cine/CineSections";
import { CineSkeleton } from "@/components/cine/CineSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { loadCineActions } from "@/app/cine/cine-data";
import { getCineLastRunAt, getHomeArrivals, getNowShowing, getUpcoming } from "@/lib/cine";
import { addDays, mxToday, staleLabel } from "@/lib/cine-core";
import { getUserStreamingPlatforms } from "@/lib/queries";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Cine",
} as const;

const NOW_RAIL = 14;
const UPCOMING_DAYS = 14;

export default function CinePage() {
  return (
    <div className="mx-auto w-full max-w-5xl">
      <Suspense fallback={<CineSkeleton />}>
        <CineBody />
      </Suspense>
    </div>
  );
}

const CineBody = async () => {
  const today = mxToday();
  const [actions, platforms, now, upcoming, lastRunAt] = await Promise.all([
    loadCineActions(),
    getUserStreamingPlatforms(),
    getNowShowing(NOW_RAIL),
    getUpcoming(addDays(today, UPCOMING_DAYS)),
    getCineLastRunAt(),
  ]);
  const home = await getHomeArrivals(platforms);
  const stale = staleLabel(lastRunAt);

  return (
    <CineActionsProvider
      existing={actions.existing}
      lists={actions.lists}
      memberships={actions.memberships}
      pinnedTitleId={actions.pinnedTitleId}
    >
      <div className="space-y-10 pb-6">
        <div className="space-y-2">
          <CineMarquee />
          {stale ? <StaleNotice label={stale} href="/cine" /> : null}
        </div>

        {now.length === 0 && upcoming.length === 0 ? (
          <EmptyState
            variant="buscar"
            title="La cartelera llega en la mañana"
            description="Cine se actualiza cada día con lo que está en los cines de México."
          />
        ) : (
          <>
            <CineSection id="en-cines" title="En cines" moreHref="/cine/cartelera">
              <NowShowingRail films={now} today={today} />
            </CineSection>

            <CineSection id="proximamente" title="Próximamente" aside="Las próximas dos semanas" moreHref="/cine/proximamente">
              <UpcomingTimeline films={upcoming} showMonths={false} />
            </CineSection>
          </>
        )}

        <CineSection
          id="ya-en-casa"
          title="Ya en casa"
          aside={platforms.length > 0 ? "Primero en tus plataformas" : "De la cartelera a streaming"}
        >
          <HomeArrivalsRail films={home} hasPlatforms={platforms.length > 0} />
        </CineSection>

        {/* Lo mejor del año (FIL-I17-5) */}
      </div>
    </CineActionsProvider>
  );
};
