import { Suspense } from "react";
import { notFound } from "next/navigation";
import { CatalogFilters } from "@/components/CatalogFilters";
import { addTitleToTag, deleteTag } from "@/app/actions/tags";
import { AddTitleToListCta } from "@/components/AddTitleToListCta";
import { DeleteCollectionButton } from "@/components/DeleteCollectionButton";
import { EditTagButton } from "@/components/EditTagButton";
import { EmptyState } from "@/components/EmptyState";
import {
  MinePlatformsEmpty,
  MinePlatformsSetupCta,
  MissingStreamingDataNote,
} from "@/components/MinePlatformsNotice";
import { TagDetailBodySkeleton } from "@/components/PageSkeletons";
import { PageHeader } from "@/components/PageHeader";
import { TitleDeckView } from "@/components/TitleDeckView";
import {
  parseKindFilter,
  parsePlatformFilters,
  TAG_ORDER_OPTIONS,
  titleMatchesKind,
} from "@/lib/catalog-filters";
import {
  getTagBySlug,
  getTitleOptionsOutsideTag,
  getTitles,
  getUserStreamingPlatforms,
} from "@/lib/queries";
import { resolveCatalogAvailability } from "@/lib/streaming-platforms";
import {
  catalogHref,
  isCatalogSort,
  parseMinePlatforms,
  tagHref,
  type CatalogSort,
} from "@/lib/tags";
import { parseSeriesStatusFilter } from "@/lib/series";

export const dynamic = "force-dynamic";

type TagDetailPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    sort?: string;
    minePlatforms?: string | string[];
    seriesStatus?: string | string[];
    kind?: string | string[];
    platform?: string | string[];
  }>;
};

export const generateMetadata = async ({ params }: TagDetailPageProps) => {
  const { slug } = await params;
  const tag = await getTagBySlug(slug);
  return { title: tag?.name ?? "Etiqueta" };
};

export default function TagDetailPage({
  params,
  searchParams,
}: TagDetailPageProps) {
  return (
    <Suspense fallback={<TagDetailBodySkeleton />}>
      <TagDetail params={params} searchParams={searchParams} />
    </Suspense>
  );
}

const TagDetail = async ({
  params,
  searchParams,
}: TagDetailPageProps) => {
  const { slug } = await params;
  const query = await searchParams;
  const sort: CatalogSort = isCatalogSort(query.sort) ? query.sort : "rating";
  const minePlatforms = parseMinePlatforms(query.minePlatforms);
  const seriesStatus = parseSeriesStatusFilter(query.seriesStatus);
  const kindFilter = parseKindFilter(query.kind);
  const platforms = parsePlatformFilters(query.platform);

  const [tag, taggedTitles, userPlatforms] = await Promise.all([
    getTagBySlug(slug),
    getTitles({ tags: [slug], sort, seriesStatus }),
    getUserStreamingPlatforms(),
  ]);

  if (!tag) {
    notFound();
  }

  const addableTitles = await getTitleOptionsOutsideTag(tag.id);

  const kindTitles = taggedTitles.filter((title) =>
    titleMatchesKind(title.kind, kindFilter),
  );
  const catalog = resolveCatalogAvailability(kindTitles, {
    platforms,
    minePlatforms,
    userPlatforms,
  });
  const titles = catalog.titles;
  const pathname = tagHref(tag.slug);
  const clearHref = catalogHref(pathname, {
    sort: sort === "rating" ? null : sort,
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title={tag.name}
        backHref="/tags"
        backLabel="Todas las etiquetas"
        actions={
          <>
            <AddTitleToListCta
              action={addTitleToTag.bind(null, tag.id)}
              target="etiqueta"
              titles={addableTitles}
              compact
            />
            <EditTagButton tagId={tag.id} tagName={tag.name} />
          </>
        }
      />

      <CatalogFilters
        tags={[]}
        selectedSlugs={[]}
        pathname={pathname}
        sort={sort === "rating" ? undefined : sort}
        defaultSort="rating"
        minePlatforms={minePlatforms}
        hasStreamingPlatforms={userPlatforms.length > 0}
        showTagFilters={false}
        seriesStatus={seriesStatus}
        kind={kindFilter}
        platforms={platforms}
        showKindChips={false}
        orderOptions={TAG_ORDER_OPTIONS}
      />

      {catalog.needsSetup ? (
        <MinePlatformsSetupCta />
      ) : taggedTitles.length === 0 ? (
        <EmptyState
          variant="tags"
          title="Nada en esta etiqueta"
          description="Pulsa Agregar para sumar títulos de tu catálogo, o busca uno nuevo."
          actionHref="/buscar"
          actionLabel="Ir a Buscar"
        />
      ) : titles.length === 0 && (minePlatforms || platforms.length > 0) ? (
        <>
          <MissingStreamingDataNote count={catalog.missingCache} />
          <MinePlatformsEmpty
            userPlatforms={platforms.length > 0 ? platforms : userPlatforms}
            actionHref={clearHref}
          />
        </>
      ) : titles.length === 0 ? (
        <EmptyState
          variant="tags"
          title="Nada con estos filtros"
          description="Ningún título de esta etiqueta coincide. Prueba con otro tipo."
          actionHref={clearHref}
          actionLabel="Quitar filtros"
        />
      ) : (
        <>
          <MissingStreamingDataNote count={catalog.missingCache} />
          <TitleDeckView titles={titles} tagId={tag.id} />
        </>
      )}

      <footer className="mt-16 flex justify-center border-t border-line/70 pt-8 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <DeleteCollectionButton
          action={deleteTag.bind(null, tag.id)}
          redirectHref="/tags"
          label="Eliminar etiqueta"
          name={tag.name}
          impact={
            taggedTitles.length === 0
              ? "No está asignada a ningún título."
              : `Se quitará de ${taggedTitles.length === 1 ? "1 título" : `${taggedTitles.length} títulos`}.`
          }
        />
      </footer>
    </div>
  );
}
