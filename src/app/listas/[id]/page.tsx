import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { addTitleToList, deleteList } from "@/app/actions/lists";
import { AddTitleToListCta } from "@/components/AddTitleToListCta";
import { CatalogFilters } from "@/components/CatalogFilters";
import { DeleteCollectionButton } from "@/components/DeleteCollectionButton";
import { EmptyState } from "@/components/EmptyState";
import { ListTitlesView } from "@/components/ListTitlesView";
import {
  MinePlatformsEmpty,
  MinePlatformsSetupCta,
  MissingStreamingDataNote,
} from "@/components/MinePlatformsNotice";
import { ListsBodySkeleton } from "@/components/PageSkeletons";
import { PageHeader } from "@/components/PageHeader";
import {
  parseCatalogOrder,
  parseKindFilter,
  parsePlatformFilters,
  sortCatalogByTitle,
  titleMatchesKind,
} from "@/lib/catalog-filters";
import { emptyStateForList, isFixedListSlug, WATCHLIST_SLUG } from "@/lib/lists";
import { getListById, getTagFilters, getTitleOptionsOutsideList, getUserStreamingPlatforms } from "@/lib/queries";
import { resolveCatalogAvailability } from "@/lib/streaming-platforms";
import { catalogHref, parseMinePlatforms, parseTagSlugs, titleMatchesAnyTag } from "@/lib/tags";
import { parseSeriesStatusFilter, titleMatchesSeriesStatus } from "@/lib/series";
import { pillActionClass } from "@/lib/ui";
import { PencilIcon } from "@/components/SegmentAction";

export const dynamic = "force-dynamic";

export default function ListDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    tag?: string | string[];
    minePlatforms?: string | string[];
    seriesStatus?: string | string[];
    kind?: string | string[];
    platform?: string | string[];
    sort?: string | string[];
  }>;
}) {
  return (
    <Suspense fallback={<ListsBodySkeleton label="Cargando lista" />}>
      <ListDetail params={params} searchParams={searchParams} />
    </Suspense>
  );
}

const ListDetail = async ({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    tag?: string | string[];
    minePlatforms?: string | string[];
    seriesStatus?: string | string[];
    kind?: string | string[];
    platform?: string | string[];
    sort?: string | string[];
  }>;
}) => {
  const { id } = await params;
  const query = await searchParams;
  const selectedTags = parseTagSlugs(query.tag);
  const minePlatforms = parseMinePlatforms(query.minePlatforms);
  const seriesStatus = parseSeriesStatusFilter(query.seriesStatus);
  const kindFilter = parseKindFilter(query.kind);
  const platforms = parsePlatformFilters(query.platform);
  const sort = parseCatalogOrder(query.sort);
  const [list, availableTitles, tags, userPlatforms] = await Promise.all([
    getListById(id),
    getTitleOptionsOutsideList(id),
    getTagFilters(),
    getUserStreamingPlatforms(),
  ]);

  if (!list) {
    notFound();
  }

  if (list.kind === "WATCHLIST" || list.slug === WATCHLIST_SLUG) {
    redirect("/watchlist");
  }
  const taggedItems = list.items.filter(
    (item) =>
      titleMatchesKind(item.title.kind, kindFilter) &&
      titleMatchesAnyTag(item.title.tags, selectedTags),
  );
  const statusItems = taggedItems.filter((item) =>
    titleMatchesSeriesStatus(item.title, seriesStatus),
  );
  const catalog = resolveCatalogAvailability(
    statusItems.map((item) => item.title),
    { platforms, minePlatforms, userPlatforms },
  );
  const visibleIds = new Set(catalog.titles.map((title) => title.id));
  const visibleItems = sortCatalogByTitle(
    catalog.needsSetup
      ? []
      : platforms.length > 0 || minePlatforms
        ? statusItems.filter((item) => visibleIds.has(item.title.id))
        : statusItems,
    sort,
  );
  const addAction = addTitleToList.bind(null, list.id);
  const fixed = isFixedListSlug(list.slug);
  const empty = emptyStateForList(list.slug);
  const filteredEmpty = list.items.length > 0 && visibleItems.length === 0;
  const clearHref = catalogHref(`/listas/${list.id}`, {});

  return (
    <div className="space-y-6">
      <PageHeader
        title={list.name}
        description={list.description ?? undefined}
        backHref="/listas"
        backLabel="Todas las listas"
        actions={
          <>
            <AddTitleToListCta action={addAction} titles={availableTitles} compact />
            <Link
              href={`/listas/${list.id}/editar`}
              aria-label={fixed ? "Editar descripción" : "Editar lista"}
              className={pillActionClass.neutral}
            >
              <PencilIcon />
              Editar
            </Link>
          </>
        }
      />

      <CatalogFilters
        tags={tags}
        selectedSlugs={selectedTags}
        pathname={`/listas/${list.id}`}
        kind={kindFilter}
        platforms={platforms}
        sort={sort ?? undefined}
        minePlatforms={minePlatforms}
        hasStreamingPlatforms={userPlatforms.length > 0}
        seriesStatus={seriesStatus}
        showKindChips={false}
      />

      {list.items.length === 0 ? (
        <>
          <AddTitleToListCta action={addAction} titles={availableTitles} />
          <EmptyState
            variant={empty.variant}
            title={empty.title}
            description={empty.description}
            actionHref={empty.actionHref}
            actionLabel={empty.actionLabel}
          />
        </>
      ) : catalog.needsSetup ? (
        <MinePlatformsSetupCta />
      ) : filteredEmpty && minePlatforms ? (
        <>
          <MissingStreamingDataNote count={catalog.missingCache} />
          <MinePlatformsEmpty
            userPlatforms={userPlatforms}
            actionHref={clearHref}
            hasTagFilters={selectedTags.length > 0 || Boolean(seriesStatus)}
          />
        </>
      ) : filteredEmpty ? (
        <EmptyState
          title="Nada con esos filtros"
          description="Esta lista no tiene títulos con las etiquetas o el estado de serie elegidos. El estado ignora películas."
          actionHref={clearHref}
          actionLabel="Quitar filtros"
        />
      ) : (
        <div className="space-y-4">
          <MissingStreamingDataNote count={catalog.missingCache} />
          <ListTitlesView
            listId={list.id}
            items={visibleItems}
            platforms={platforms}
          />
        </div>
      )}

      {fixed ? null : (
        <footer className="mt-16 flex justify-center border-t border-line/70 pt-8 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          <DeleteCollectionButton
            action={deleteList.bind(null, list.id)}
            redirectHref="/listas"
            label="Borrar lista"
            name={list.name}
            impact={
              list.items.length === 0
                ? "La lista está vacía."
                : `Contiene ${list.items.length === 1 ? "1 título" : `${list.items.length} títulos`}.`
            }
          />
        </footer>
      )}
    </div>
  );
}
