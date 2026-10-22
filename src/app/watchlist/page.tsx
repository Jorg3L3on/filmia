import { Suspense } from "react";
import { CatalogFilters } from "@/components/CatalogFilters";
import { EmptyState } from "@/components/EmptyState";
import { MinePlatformsSetupCta, MissingStreamingDataNote } from "@/components/MinePlatformsNotice";
import { PageHeader } from "@/components/PageHeader";
import { WatchlistBodySkeleton } from "@/components/PageSkeletons";
import { WatchlistCartelera } from "@/components/watchlist/WatchlistCartelera";
import { WatchlistEditingProvider, WatchlistReorderButton } from "@/components/watchlist/WatchlistEditing";
import { WatchlistFilterRail } from "@/components/watchlist/WatchlistFilterRail";
import { parseKindFilter, parsePlatformFilters, titleMatchesKind } from "@/lib/catalog-filters";
import type { CatalogQuery } from "@/lib/catalog-href";
import {
  getCurrentUserProfile,
  getUserStreamingPlatforms,
  getWatchlist,
} from "@/lib/queries";
import { scheduleMissingTitleOverviews } from "@/lib/title-overview-schedule";
import { formatUserPlatformsList, resolveCatalogAvailability } from "@/lib/streaming-platforms";
import { parseMinePlatforms } from "@/lib/catalog-href";
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
  seriesStatus?: string | string[];
  tonight?: string | string[];
  short?: string | string[];
  awarded?: string | string[];
  genre?: string | string[];
};

/** Desktop keeps the big page title; the phone folds it into the filter row (FIL-I21-7). */
const WatchlistHeader = () => (
  <div className="hidden sm:block">
    <PageHeader title="Quiero ver" />
  </div>
);

/** Phone header: «Quiero ver» with the count beside it, on the row of the round buttons. */
const WatchlistCompactTitle = ({ count }: { count: number }) => (
  <h1 className="flex min-w-0 items-baseline gap-2 truncate font-serif text-[1.75rem] leading-none tracking-tight text-paper">
    Quiero ver
    <span className="font-sans text-sm font-semibold tabular-nums text-mist" aria-label={`${count} ${count === 1 ? "título" : "títulos"}`}>
      {count}
    </span>
  </h1>
);

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
    <div className="space-y-5 max-sm:-mt-6 max-sm:space-y-1">
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
  const seriesStatus = parseSeriesStatusFilter(params.seriesStatus);
  const tonight = parseFlag(params.tonight);
  const short = parseFlag(params.short);
  const awarded = parseFlag(params.awarded);
  const genreIds = parseGenreIds(params.genre);
  const now = new Date();

  const [watchlist, userPlatforms, profile] = await Promise.all([
    getWatchlist(),
    getUserStreamingPlatforms(),
    getCurrentUserProfile(),
  ]);

  const rawItems = watchlist?.items ?? [];
  const kindItems = rawItems.filter(
    (item) =>
      titleMatchesKind(item.title.kind, kindFilter) &&
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
  const genres = genresInList(rawItems);
  const hasExtraFilters =
    kindFilter !== "ALL" ||
    Boolean(seriesStatus) ||
    platforms.length > 0 ||
    minePlatforms ||
    Boolean(sort) ||
    tonight ||
    short ||
    awarded ||
    genreIds.length > 0;

  const railQuery: CatalogQuery = {
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

  const canReorder = !hasExtraFilters && items.length > 1;

  return (
    <WatchlistEditingProvider canReorder={canReorder}>
      <CatalogFilters
        pathname="/watchlist"
        heading={<WatchlistCompactTitle count={items.length} />}
        headingActions={<WatchlistReorderButton />}
        kind={kindFilter}
        platforms={platforms}
        sort={sort ?? undefined}
        minePlatforms={minePlatforms}
        hasStreamingPlatforms={userPlatforms.length > 0}
        seriesStatus={seriesStatus}
        showKindChips={false}
        showSort={false}
        minePlatformsInBar
        extraQuery={{ tonight, short, awarded, genres: genreIds }}
        leading={
          <WatchlistFilterRail
            pathname="/watchlist"
            query={railQuery}
            sort={sort}
            genres={genres}
            counts={{
              short: applyWatchlistFilters(rawItems, { short: true }).length,
              awarded: applyWatchlistFilters(rawItems, { awarded: true }).length,
            }}
            nightEnds={nightEnds}
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
      ) : (
        // Empty too (FIL-I24-4): the cartelera keeps the count bar at 0 and names the chip to blame.
        <div className="space-y-4">
          <MissingStreamingDataNote count={catalog.missingCache} />
          <WatchlistCartelera
            fichas={fichas}
            listId={listId}
            nightEnds={nightEnds}
            isManualOrder={!hasExtraFilters}
            tonightOnly={tonight}
            pinnedTitleId={signals.pinnedTitleId}
            sort={sort}
            query={railQuery}
            pathname="/watchlist"
            genreName={genreIds.length === 1 ? (genres.find((genre) => genre.id === genreIds[0])?.name ?? null) : null}
            platformsLabel={formatUserPlatformsList(platforms.length > 0 ? platforms : userPlatforms) || null}
          />
        </div>
      )}
    </WatchlistEditingProvider>
  );
};
