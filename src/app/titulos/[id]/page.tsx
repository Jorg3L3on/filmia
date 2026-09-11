import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { deleteTitle } from "@/app/actions/titles";
import { Button } from "@/components/Button";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { FichaWatchedSection } from "@/components/FichaWatchedSection";
import {
  TitleActionsSkeleton,
  TitleProvidersSkeleton,
} from "@/components/PageSkeletons";
import { SeriesStatusPanel } from "@/components/SeriesStatusPanel";
import {
  getAssignableLists,
  getRelatedTitles,
  getTagFilters,
  getTitleById,
  getUserStreamingPlatforms,
} from "@/lib/queries";
import { FichaVisit } from "@/components/FichaVisit";
import { resolveTitleExtras, storedTitleExtras } from "@/lib/title-extras";
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
  const listsPromise = getAssignableLists();
  const tagsPromise = getTagFilters();
  const platformsPromise = getUserStreamingPlatforms();
  const providersPromise = getWatchProvidersForTitle(title);
  const relatedPromise = getRelatedTitles(
    title.id,
    title.tags.map((item) => item.tagId),
  );

  const deleteAction = deleteTitle.bind(null, title.id);

  return (
    <article className="space-y-8">
      <FichaVisit titleId={title.id} />
      <Suspense fallback={<TitleHeroFallback title={title} extras={storedTitleExtras(title)} />}>
        <TitleHeroBlock title={title} extrasPromise={extrasPromise} />
      </Suspense>

      <Suspense fallback={<TitleActionsSkeleton />}>
        <TitleActionsBlock
          title={title}
          listsPromise={listsPromise}
          tagsPromise={tagsPromise}
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
        />
      ) : null}

      <Suspense fallback={null}>
        <TitleRelatedBlock relatedPromise={relatedPromise} />
      </Suspense>

      <div className="flex flex-wrap gap-3 pt-2">
        <Button href={`/titulos/${title.id}/editar`} variant="ghost">
          Editar ficha
        </Button>
        <ConfirmSubmit
          label="Borrar"
          confirmMessage={`¿Borrar “${title.name}”?`}
          href="/"
          action={deleteAction}
        />
      </div>
    </article>
  );
};
