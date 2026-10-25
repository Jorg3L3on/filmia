import { Suspense } from "react";
import { BestOfYearSection } from "@/components/cine/BestOfYear";
import { CineActionsProvider } from "@/components/cine/CineActions";
import { CineMarquee, CineSection, StaleNotice } from "@/components/cine/CineParts";
import { HomeArrivalsRail, NowShowingRail, UpcomingTimeline } from "@/components/cine/CineSections";
import { CineSkeleton } from "@/components/cine/CineSkeleton";
import { ParaTiEnSala } from "@/components/cine/ParaTiEnSala";
import { EmptyState } from "@/components/EmptyState";
import { loadCineActions } from "@/app/cine/cine-data";
import { getCineLastRunAt, getHomeArrivals, getNowShowing, getUpcoming } from "@/lib/cine";
import { addDays, mxToday, staleLabel } from "@/lib/cine-core";
import { parseTopYear } from "@/lib/cine-top";
import { getUserStreamingPlatforms } from "@/lib/queries";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Cine",
} as const;

const NOW_RAIL = 14;
const UPCOMING_DAYS = 14;

type SearchParams = { anio?: string | string[] };

export default function CinePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return (
    <div className="mx-auto w-full max-w-5xl">
      <Suspense fallback={<CineSkeleton />}>
        <CineBody searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

const CineBody = async ({ searchParams }: { searchParams: Promise<SearchParams> }) => {
  const today = mxToday();
  const topYear = parseTopYear((await searchParams).anio, today);
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
          {stale ? <StaleNotice label={stale} /> : null}
        </div>

        {/* FIL-I26-5: only when someone of your universe has a premiere coming. */}
        <Suspense fallback={null}>
          <ParaTiEnSala userId={actions.userId} />
        </Suspense>

        {now.length === 0 && upcoming.length === 0 ? (
          <EmptyState
            variant="buscar"
            compact
            title="La cartelera llega en la mañana"
            description="Cine se actualiza cada día con lo que está en los cines de México."
          />
        ) : (
          <>
            <CineSection id="en-cines" title="En cines" moreHref="/cine/cartelera">
              <NowShowingRail films={now} today={today} />
            </CineSection>

            <CineSection id="proximamente" title="Próximamente" aside="Las próximas dos semanas" moreHref="/cine/proximamente">
              <UpcomingTimeline films={upcoming} showMonths={false} linkWeeks />
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

        <Suspense fallback={<CineSkeleton sections={1} marquee={false} label="Cargando lo mejor del año" />}>
          <BestOfYearSection userId={actions.userId} year={topYear} />
        </Suspense>
      </div>
    </CineActionsProvider>
  );
};
