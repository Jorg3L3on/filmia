import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { FichaWatchedSection } from "@/components/FichaWatchedSection";
import {
  TitleActionsSkeleton,
  TitleProvidersSkeleton,
} from "@/components/PageSkeletons";
import { RelinkTitleSheet } from "@/components/RelinkTitleSheet";
import { SeriesStatusPanel } from "@/components/SeriesStatusPanel";
import { metadataServicesConfigured } from "@/lib/metadata";
import {
  getAssignableLists,
  getRelatedTitles,
  getTitleById,
  getUserStreamingPlatforms,
} from "@/lib/queries";
import { FichaVisit } from "@/components/FichaVisit";
import { parseStoredTmdbGenres } from "@/lib/diary-picks";
import { resolveTitleExtras, storedTitleExtras } from "@/lib/title-extras";
import { resolveTitlePeople } from "@/lib/title-people";
import { getWatchProvidersForTitle } from "@/lib/watch-providers-cache";
import TitleLoading from "./loading";
import {
  TitleActionsBlock,
  TitleHeroBlock,
  TitleHeroFallback,
  TitleProvidersBlock,
  TitleRelatedBlock,
  TitleSynopsisBlock,
  isSeriesTitle,
} from "./title-sections";

export const dynamic = "force-dynamic";

type TitlePageProps = {
  params: Promise<{ id: string }>;
};

const buildFichaDescription = (
  title: NonNullable<Awaited<ReturnType<typeof getTitleById>>>,
) => {
  const kindLabel = title.kind === "SERIES" ? "Serie" : "Película";
  const lead = [title.year ? String(title.year) : null, kindLabel]
    .filter(Boolean)
    .join(" · ");
  const overview = title.overview?.trim();
  if (overview) {
    const short = overview.length > 140 ? `${overview.slice(0, 137)}…` : overview;
    return lead ? `${lead}. ${short}` : short;
  }
  return lead
    ? `${lead} en Filmia.`
    : "Ficha en Filmia, tu diario de películas y series.";
};

export const generateMetadata = async ({
  params,
}: TitlePageProps): Promise<Metadata> => {
  const { id } = await params;
  const title = await getTitleById(id);
  if (!title) {
    return {
      title: "Título",
      description: "Ficha en Filmia, tu diario de películas y series.",
    };
  }

  const description = buildFichaDescription(title);
  return {
    title: title.name,
    description,
    openGraph: {
      title: title.name,
      description,
      type: "website",
    },
  };
};

export default function TitleDetailPage({ params }: TitlePageProps) {
  return (
    <Suspense fallback={<TitleLoading />}>
      <TitleDetail params={params} />
    </Suspense>
  );
}

const TitleDetail = async ({
  params,
}: {
  params: Promise<{ id: string }>;
}) => {
  const { id } = await params;
  const title = await getTitleById(id);

  if (!title) {
    notFound();
  }

  const extrasPromise = resolveTitleExtras(title);
  const peoplePromise = resolveTitlePeople(title);
  const listsPromise = getAssignableLists();
  const platformsPromise = getUserStreamingPlatforms();
  const providersPromise = getWatchProvidersForTitle(title);
  const relatedPromise = getRelatedTitles(
    title.id,
    parseStoredTmdbGenres(title.tmdbGenres).map((genre) => genre.id),
  );

  return (
    <article className="space-y-8">
      <FichaVisit titleId={title.id} name={title.name} />
      <Suspense fallback={<TitleHeroFallback title={title} extras={storedTitleExtras(title)} />}>
        <TitleHeroBlock title={title} extrasPromise={extrasPromise} />
      </Suspense>

      <Suspense fallback={<TitleActionsSkeleton />}>
        <TitleActionsBlock
          title={title}
          listsPromise={listsPromise}
        />
      </Suspense>

      <Suspense fallback={<TitleProvidersSkeleton />}>
        <TitleProvidersBlock
          providersPromise={providersPromise}
          platformsPromise={platformsPromise}
        />
      </Suspense>

      <Suspense fallback={null}>
        <TitleSynopsisBlock
          storedOverview={title.overview}
          extrasPromise={extrasPromise}
          peoplePromise={peoplePromise}
          kind={title.kind}
        />
      </Suspense>

      {isSeriesTitle(title) ? (
        <SeriesStatusPanel
          titleId={title.id}
          seriesStatus={title.seriesStatus}
          seriesSeason={title.seriesSeason}
        />
      ) : null}

      {title.watchedAt ? (
        <FichaWatchedSection
          titleId={title.id}
          titleName={title.name}
          watchedAt={title.watchedAt}
          rating={title.rating}
          review={title.review}
          platform={title.platform}
        />
      ) : null}

      <Suspense fallback={null}>
        <TitleRelatedBlock relatedPromise={relatedPromise} />
      </Suspense>

      <RelinkTitleSheet
        titleId={title.id}
        titleName={title.year ? `${title.name} (${title.year})` : title.name}
        searchName={title.name}
        kind={title.kind}
        tmdbId={title.tmdbId}
        configuredTmdb={metadataServicesConfigured().tmdb}
      />
    </article>
  );
};
