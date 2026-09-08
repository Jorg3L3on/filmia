import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { deleteTitle } from "@/app/actions/titles";
import { Button } from "@/components/Button";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { MarkWatchedForm } from "@/components/MarkWatchedForm";
import {
  TitleActionsSkeleton,
  TitleProvidersSkeleton,
} from "@/components/PageSkeletons";
import { SeriesStatusPanel } from "@/components/SeriesStatusPanel";
import { WatchedBadge } from "@/components/WatchedBadge";
import { formatWatchedDate } from "@/lib/dates";
import {
  getAssignableLists,
  getRelatedTitles,
  getTagFilters,
  getTitleById,
  getUserStreamingPlatforms,
} from "@/lib/queries";
import { wellClass } from "@/lib/ui";
import { FichaVisit } from "@/components/FichaVisit";
import { resolveTitleExtras, storedTitleExtras } from "@/lib/title-extras";
import { getWatchProvidersForTitle } from "@/lib/watch-providers-cache";
import TitleLoading from "./loading";
import { AUTH_PAGE_DYNAMIC } from "@/lib/rendering";
import {
  TitleActionsBlock,
  TitleHeroBlock,
  TitleHeroFallback,
  TitleProvidersBlock,
  TitleRelatedBlock,
  TitleSynopsisBlock,
  isSeriesTitle,
} from "./title-sections";

export const dynamic = AUTH_PAGE_DYNAMIC;

type TitlePageProps = {
  params: Promise<{ id: string }>;
};

export const generateMetadata = async ({
  params,
}: TitlePageProps): Promise<Metadata> => {
  const { id } = await params;
  const title = await getTitleById(id);
  return { title: title?.name ?? "Título" };
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
        <section className={`${wellClass} space-y-4 p-5`}>
          <header className="space-y-1">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-success">
              Mi registro
            </p>
            <h2 className="font-serif text-xl text-paper">{title.name}</h2>
            <p className="flex flex-wrap items-center gap-2 text-sm text-fog">
              <WatchedBadge />
              Vista el {formatWatchedDate(title.watchedAt)}
            </p>
          </header>
          <MarkWatchedForm
            titleId={title.id}
            variant="detail"
            watchedAt={title.watchedAt}
            rating={title.rating}
            review={title.review}
          />
        </section>
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
