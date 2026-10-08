import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { addTitleToList } from "@/app/actions/lists";
import { AddTitleToListCta } from "@/components/AddTitleToListCta";
import { CatalogFilters } from "@/components/CatalogFilters";
import { EmptyState } from "@/components/EmptyState";
import { ListTitlesView } from "@/components/ListTitlesView";
import { NavLabel } from "@/components/NavOriginTracker";
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
import {
  emptyStateForList,
  isFixedListSlug,
  isSeriesStatusListSlug,
  WATCHLIST_SLUG,
} from "@/lib/lists";
import { metadataServicesConfigured } from "@/lib/metadata";
import { parseDeckCard } from "@/lib/nav-origin";
import { getListById, getTitleOptionsOutsideList, getUserStreamingPlatforms } from "@/lib/queries";
import { resolveCatalogAvailability } from "@/lib/streaming-platforms";
import { tmdbCatalogKey } from "@/lib/tmdb-search-catalog";
import { catalogHref, parseMinePlatforms } from "@/lib/catalog-href";
import { parseSeriesStatusFilter, titleMatchesSeriesStatus } from "@/lib/series";
import {
  PencilIcon,
  SegmentActionTooltip,
  segmentActionCompactClass,
} from "@/components/SegmentAction";

export const dynamic = "force-dynamic";

export default function ListDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    minePlatforms?: string | string[];
    seriesStatus?: string | string[];
    kind?: string | string[];
    platform?: string | string[];
    sort?: string | string[];
    carta?: string | string[];
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
    minePlatforms?: string | string[];
    seriesStatus?: string | string[];
    kind?: string | string[];
    platform?: string | string[];
    sort?: string | string[];
    carta?: string | string[];
  }>;
}) => {
  const { id } = await params;
  const query = await searchParams;
  const minePlatforms = parseMinePlatforms(query.minePlatforms);
  const seriesStatus = parseSeriesStatusFilter(query.seriesStatus);
  const kindFilter = parseKindFilter(query.kind);
  const platforms = parsePlatformFilters(query.platform);
  const sort = parseCatalogOrder(query.sort);
  const [list, availableTitles, userPlatforms] = await Promise.all([
    getListById(id),
    getTitleOptionsOutsideList(id),
    getUserStreamingPlatforms(),
  ]);

  if (!list) {
    notFound();
  }

  if (list.kind === "WATCHLIST" || list.slug === WATCHLIST_SLUG) {
    redirect("/watchlist");
  }
  const statusItems = list.items.filter(
    (item) =>
      titleMatchesKind(item.title.kind, kindFilter) &&
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
  const configuredTmdb = metadataServicesConfigured().tmdb;
  const inListKeys = list.items.flatMap((item) =>
    item.title.tmdbId != null ? [tmdbCatalogKey(item.title.tmdbId, item.title.kind)] : [],
  );
  const fixed = isFixedListSlug(list.slug);
  // «Series en progreso» / «Series abandonadas» las llena el estado de la serie.
  const automatic = isSeriesStatusListSlug(list.slug);
  const empty = emptyStateForList(list.slug);
  const filteredEmpty = list.items.length > 0 && visibleItems.length === 0;
  const clearHref = catalogHref(`/listas/${list.id}`, {});

  return (
    // Shell = Hoy's room: the deck tints the page with the hero poster's colour.
    <div className="diario-que-ver-shell space-y-6">
      <NavLabel label={`Listas · ${list.name}`} />
      <PageHeader
        title={list.name}
        description={list.description ?? undefined}
        backHref="/listas"
        backLabel="Todas las listas"
        inlineActions
        actions={
          <>
            {automatic ? null : (
              <AddTitleToListCta
                action={addAction}
                titles={availableTitles}
                listId={list.id}
                configuredTmdb={configuredTmdb}
                inListKeys={inListKeys}
                compact
              />
            )}
            <Link
              href={`/listas/${list.id}/editar`}
              aria-label={fixed ? "Editar descripción" : "Editar lista"}
              className={segmentActionCompactClass}
            >
              <PencilIcon className="size-5 group-hover/action:-rotate-12" />
              <SegmentActionTooltip label={fixed ? "Editar descripción" : "Editar lista"} />
            </Link>
          </>
        }
      />

      <CatalogFilters
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
          {automatic ? null : (
            <AddTitleToListCta
              action={addAction}
              titles={availableTitles}
              listId={list.id}
              configuredTmdb={configuredTmdb}
              inListKeys={inListKeys}
            />
          )}
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
            hasFilters={Boolean(seriesStatus)}
          />
        </>
      ) : filteredEmpty ? (
        <EmptyState
          title="Nada con esos filtros"
          description="Esta lista no tiene títulos con los filtros elegidos. El estado de serie ignora películas."
          actionHref={clearHref}
          actionLabel="Quitar filtros"
        />
      ) : (
        <div className="space-y-4">
          <MissingStreamingDataNote count={catalog.missingCache} />
          <ListTitlesView
            listId={automatic ? undefined : list.id}
            items={visibleItems}
            platforms={platforms}
            initialCardId={parseDeckCard(query.carta)}
          />
        </div>
      )}
    </div>
  );
}
