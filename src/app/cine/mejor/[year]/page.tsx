import { Suspense } from "react";
import { notFound } from "next/navigation";
import { loadCineActions } from "@/app/cine/cine-data";
import { BestOfYearList, loadBestOfYear, YearSelector } from "@/components/cine/BestOfYear";
import { CineActionsProvider } from "@/components/cine/CineActions";
import { CineMarquee } from "@/components/cine/CineParts";
import { CineSkeleton } from "@/components/cine/CineSkeleton";
import { YourTopCard } from "@/components/cine/YourTopCard";
import { mxToday } from "@/lib/cine-core";
import { FIRST_TOP_YEAR } from "@/lib/cine-top";

export const dynamic = "force-dynamic";

type Params = { year: string };

export const generateMetadata = async ({ params }: { params: Promise<Params> }) => ({
  title: `Lo mejor de ${(await params).year}`,
});

export default async function BestOfYearPage({ params }: { params: Promise<Params> }) {
  const year = Number((await params).year);
  if (!Number.isInteger(year) || year < FIRST_TOP_YEAR || year > Number(mxToday().slice(0, 4))) {
    notFound();
  }
  return (
    <div className="mx-auto w-full max-w-3xl space-y-8">
      <CineMarquee title={`Lo mejor de ${year}`} subtitle="Según la nota y los votos de IMDb" backHref="/cine" />
      <Suspense fallback={<CineSkeleton sections={1} marquee={false} />}>
        <BestOfYearBody year={year} />
      </Suspense>
    </div>
  );
}

const BestOfYearBody = async ({ year }: { year: number }) => {
  const actions = await loadCineActions();
  const data = await loadBestOfYear(actions.userId, year);
  const seen = data.top.filter((film) => data.watchedIds.has(film.catalogId)).length;

  return (
    <CineActionsProvider
      existing={actions.existing}
      lists={actions.lists}
      memberships={actions.memberships}
      pinnedTitleId={actions.pinnedTitleId}
    >
      <div className="space-y-6">
        <YearSelector year={year} hrefFor={(option) => `/cine/mejor/${option}`} />
        {data.top.length > 0 ? (
          <p className="text-sm text-fog">
            Has visto <span className="font-semibold text-paper">{seen}</span> de {data.top.length}
          </p>
        ) : null}
        <BestOfYearList year={year} top={data.top} watchedIds={data.watchedIds} pending={data.pending} />
        <YourTopCard year={year} top={data.yours} watched={data.watched} />
      </div>
    </CineActionsProvider>
  );
};
