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
import { WatchlistCartelera } from "@/components/watchlist/WatchlistCartelera";
import { WatchlistFilterRail } from "@/components/watchlist/WatchlistFilterRail";
import { parseKindFilter, parsePlatformFilters, titleMatchesKind } from "@/lib/catalog-filters";
import type { CatalogQuery } from "@/lib/catalog-href";
import {
  getCurrentUserProfile,
  getTagFilters,
  getUserStreamingPlatforms,
  getWatchlist,
} from "@/lib/queries";
import { scheduleMissingTitleOverviews } from "@/lib/title-overview-schedule";
import { resolveCatalogAvailability } from "@/lib/streaming-platforms";
import { catalogHref, parseMinePlatforms, parseTagSlugs, titleMatchesAnyTag } from "@/lib/tags";
import { parseSeriesStatusFilter, titleMatchesSeriesStatus } from "@/lib/series";
import { parseNightEnds } from "@/lib/tonight/time";
import { buildWatchlistFichas, type WatchlistSignals } from "@/lib/watchlist-ficha";
import {
  applyWatchlistFilters,
  genresInList,
  parseFlag,
  parseGenreIds,
  parseWatchlistSort,
  sortWatchlistItems,
} from "@/lib/watchlist-filters";
import { loadWatchlistSignals } from "@/lib/watchlist-hook-store";

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
  tonight?: string | string[];
  short?: string | string[];
  awarded?: string | string[];
  genre?: string | string[];
};

const WatchlistHeader = () => <PageHeader title="Quiero ver" />;

const EMPTY_SIGNALS: WatchlistSignals = {
  reasonsByTitle: new Map(),
  snoozedUntilByTitle: new Map(),
  pinnedTitleId: null,
};

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
  const sort = parseWatchlistSort(params.sort);
  const selectedTags = parseTagSlugs(params.tag);
  const seriesStatus = parseSeriesStatusFilter(params.seriesStatus);
  const tonight = parseFlag(params.tonight);
  const short = parseFlag(params.short);
  const awarded = parseFlag(params.awarded);
  const genreIds = parseGenreIds(params.genre);
  const now = new Date();

  const [watchlist, userPlatforms, tags, profile] = await Promise.all([
    getWatchlist(),
    getUserStreamingPlatforms(),
    getTagFilters(),
    getCurrentUserProfile(),
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
  const availableItems =
    catalog.needsSetup
      ? []
      : platforms.length > 0 || minePlatforms
        ? kindItems.filter((item) => visibleIds.has(item.title.id))
        : kindItems;
  // «Esta noche» is applied on the client: it needs the viewer's clock.
  const items = sortWatchlistItems(
    applyWatchlistFilters(availableItems, { short, awarded, genreIds }),
    sort,
  );
  scheduleMissingTitleOverviews(items.map((item) => item.title));

  const signals = profile ? await loadWatchlistSignals(profile.id, now) : EMPTY_SIGNALS;
  const fichas = buildWatchlistFichas(items, { signals, userPlatforms, now });
  const nightEnds = profile?.nightEnds ?? parseNightEnds(null);

  const listId = watchlist?.id ?? "";
  const clearHref = catalogHref("/watchlist");
  const hasExtraFilters =
    kindFilter !== "ALL" ||
    selectedTags.length > 0 ||
    Boolean(seriesStatus) ||
    platforms.length > 0 ||
    minePlatforms ||
    Boolean(sort) ||
    tonight ||
    short ||
    awarded ||
    genreIds.length > 0;

  const railQuery: CatalogQuery = {
    tags: selectedTags,
    sort,
    minePlatforms,
    seriesStatus,
    kind: kindFilter,
    platforms,
    tonight,
    short,
    awarded,
    genres: genreIds,
  };

  return (
    <>
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
        showKindChips={false}
        showSort={false}
        extraQuery={{ tonight, short, awarded, genres: genreIds }}
        leading={
          <WatchlistFilterRail
            pathname="/watchlist"
            query={railQuery}
            sort={sort}
            genres={genresInList(rawItems)}
          />
        }
      />

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
              Boolean(seriesStatus) ||
              short ||
              awarded ||
              genreIds.length > 0
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
          <WatchlistCartelera
            fichas={fichas}
            listId={listId}
            nightEnds={nightEnds}
            isManualOrder={!hasExtraFilters}
            tonightOnly={tonight}
            pinnedTitleId={signals.pinnedTitleId}
          />
        </div>
      )}
    </>
  );
};
