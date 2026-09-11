import { Suspense } from "react";
import { CatalogFilters } from "@/components/CatalogFilters";
import { EmptyState } from "@/components/EmptyState";
import {
  MinePlatformsEmpty,
  MinePlatformsSetupCta,
  MissingStreamingDataNote,
} from "@/components/MinePlatformsNotice";
import { PageHeader } from "@/components/PageHeader";
import { WatchlistBodySkeleton } from "@/components/PageSkeletons";
import { WatchlistList } from "@/components/WatchlistList";
import {
  parseCatalogOrder,
  parseKindFilter,
  parsePlatformFilters,
  sortCatalogByTitle,
  titleMatchesKind,
} from "@/lib/catalog-filters";
import { getTagFilters, getUserStreamingPlatforms, getWatchlist } from "@/lib/queries";
import { scheduleMissingTitleOverviews } from "@/lib/title-overview-schedule";
import { resolveCatalogAvailability } from "@/lib/streaming-platforms";
import { catalogHref, parseMinePlatforms, parseTagSlugs, titleMatchesAnyTag } from "@/lib/tags";
import { parseSeriesStatusFilter, titleMatchesSeriesStatus } from "@/lib/series";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Quiero ver",
};

type WatchlistSearchParams = {
  kind?: string | string[];
  minePlatforms?: string | string[];
  platform?: string | string[];
  sort?: string | string[];
  tag?: string | string[];
  seriesStatus?: string | string[];
};

const WatchlistHeader = () => <PageHeader title="Quiero ver" />;

export default function WatchlistPage({
  searchParams,
}: {
  searchParams: Promise<WatchlistSearchParams>;
}) {
  return (
    <div className="space-y-5">
      <WatchlistHeader />
      <Suspense fallback={<WatchlistBodySkeleton />}>
        <WatchlistBody searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

const WatchlistBody = async ({
  searchParams,
}: {
  searchParams: Promise<WatchlistSearchParams>;
}) => {
  const params = await searchParams;
  const kindFilter = parseKindFilter(params.kind);
  const minePlatforms = parseMinePlatforms(params.minePlatforms);
  const platforms = parsePlatformFilters(params.platform);
  const sort = parseCatalogOrder(params.sort);
  const selectedTags = parseTagSlugs(params.tag);
  const seriesStatus = parseSeriesStatusFilter(params.seriesStatus);

  const [watchlist, userPlatforms, tags] = await Promise.all([
    getWatchlist(),
    getUserStreamingPlatforms(),
    getTagFilters(),
  ]);

  const rawItems = watchlist?.items ?? [];
  const kindItems = rawItems.filter(
    (item) =>
      titleMatchesKind(item.title.kind, kindFilter) &&
      titleMatchesAnyTag(item.title.tags, selectedTags) &&
      titleMatchesSeriesStatus(item.title, seriesStatus),
  );
  const catalog = resolveCatalogAvailability(
    kindItems.map((item) => item.title),
    { platforms, minePlatforms, userPlatforms },
  );
  const visibleIds = new Set(catalog.titles.map((title) => title.id));
  const filteredItems =
    catalog.needsSetup
      ? []
      : platforms.length > 0 || minePlatforms
        ? kindItems.filter((item) => visibleIds.has(item.title.id))
        : kindItems;
  const items = sortCatalogByTitle(filteredItems, sort);
  scheduleMissingTitleOverviews(items.map((item) => item.title));

  const listId = watchlist?.id ?? "";
  const clearHref = catalogHref("/watchlist");
  const hasExtraFilters =
    kindFilter !== "ALL" ||
    selectedTags.length > 0 ||
    Boolean(seriesStatus) ||
    platforms.length > 0 ||
    minePlatforms ||
    Boolean(sort);

  return (
    <>
      <div className="space-y-2">
        <CatalogFilters
          tags={tags}
          selectedSlugs={selectedTags}
          pathname="/watchlist"
          kind={kindFilter}
          platforms={platforms}
          sort={sort ?? undefined}
          minePlatforms={minePlatforms}
          hasStreamingPlatforms={userPlatforms.length > 0}
          seriesStatus={seriesStatus}
        />
        {rawItems.length > 0 && items.length > 0 && hasExtraFilters ? (
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-mist">
            {items.length === 1 ? "1 título" : `${items.length} títulos`}
          </p>
        ) : null}
      </div>

      {rawItems.length === 0 ? (
        <EmptyState
          variant="watchlist"
          title="Aún no hay nada en Quiero ver"
          description="Añade títulos desde Buscar o desde una ficha."
          actionHref="/buscar"
          actionLabel="Ir a Buscar"
        />
      ) : catalog.needsSetup ? (
        <MinePlatformsSetupCta />
      ) : items.length === 0 && (minePlatforms || platforms.length > 0) ? (
        <div className="space-y-3">
          <MissingStreamingDataNote count={catalog.missingCache} />
          <MinePlatformsEmpty
            userPlatforms={platforms.length > 0 ? platforms : userPlatforms}
            actionHref={clearHref}
            hasTagFilters={
              kindFilter !== "ALL" ||
              selectedTags.length > 0 ||
              Boolean(seriesStatus)
            }
          />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          variant="watchlist"
          title="Nada con ese filtro"
          description="Prueba otra pestaña o quita filtros."
          actionHref="/watchlist"
          actionLabel="Ver todos"
        />
      ) : (
        <div className="space-y-4">
          <MissingStreamingDataNote count={catalog.missingCache} />
          <WatchlistList
            items={items}
            listId={listId}
            preferredPlatforms={userPlatforms}
          />
        </div>
      )}
    </>
  );
};
