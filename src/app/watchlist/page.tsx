import Link from "next/link";
import { ensureCurrentUserWatchlist, removeFromWatchlist } from "@/app/actions/watchlist";
import { CatalogFilters } from "@/components/CatalogFilters";
import { EmptyState } from "@/components/EmptyState";
import {
  MinePlatformsEmpty,
  MinePlatformsSetupCta,
  MissingStreamingDataNote,
} from "@/components/MinePlatformsNotice";
import { WatchlistCard } from "@/components/WatchlistCard";
import {
  parseCatalogOrder,
  parseKindFilter,
  parsePlatformFilters,
  sortCatalogByTitle,
  titleMatchesKind,
} from "@/lib/catalog-filters";
import { getTags, getUserStreamingPlatforms, getWatchlist } from "@/lib/queries";
import { hydrateMissingTitleOverviews } from "@/lib/title-overview";
import { resolveCatalogAvailability } from "@/lib/streaming-platforms";
import { catalogHref, parseMinePlatforms, parseTagSlugs, titleMatchesAnyTag } from "@/lib/tags";
import { parseSeriesStatusFilter, titleMatchesSeriesStatus } from "@/lib/series";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/ui";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Quiero ver",
};

export default async function WatchlistPage({
  searchParams,
}: {
  searchParams: Promise<{
    kind?: string | string[];
    minePlatforms?: string | string[];
    platform?: string | string[];
    sort?: string | string[];
    tag?: string | string[];
    seriesStatus?: string | string[];
  }>;
}) {
  await ensureCurrentUserWatchlist();
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
    getTags(),
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
  await hydrateMissingTitleOverviews(items.map((item) => item.title));

  const listId = watchlist?.id ?? "";
  const [hero, ...queue] = items;
  const clearHref = catalogHref("/watchlist");

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-3">
        <h1 className="font-serif text-4xl tracking-tight text-paper">Quiero ver</h1>
        <Link
          href="/buscar"
          aria-label="Buscar para agregar"
          className={cn(
            "inline-flex h-10 w-10 items-center justify-center rounded-full border border-chrome text-fog hover:text-paper",
            focusRing,
          )}
        >
          <SearchIcon />
        </Link>
      </header>

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
        <>
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
        </>
      ) : items.length === 0 ? (
        <EmptyState
          variant="watchlist"
          title="Nada con ese filtro"
          description="Prueba otra pestaña o quita filtros."
          actionHref="/watchlist"
          actionLabel="Ver todos"
        />
      ) : (
        <div className="space-y-5">
          <MissingStreamingDataNote count={catalog.missingCache} />
          {hero ? (
            <WatchlistCard
              item={hero}
              variant="hero"
              position={1}
              listId={listId}
              canMoveUp={false}
              canMoveDown={queue.length > 0}
              swapDownTitleId={queue[0]?.titleId}
              removeAction={removeFromWatchlist.bind(null, hero.titleId)}
              preferredPlatforms={userPlatforms}
            />
          ) : null}

          {queue.length > 0 ? (
            <ul className="divide-y divide-line">
              {queue.map((item, index) => {
                const visibleIndex = index + 1;
                return (
                  <li key={item.titleId}>
                    <WatchlistCard
                      item={item}
                      variant="queue"
                      position={index + 2}
                      listId={listId}
                      canMoveUp
                      canMoveDown={index < queue.length - 1}
                      swapUpTitleId={items[visibleIndex - 1]?.titleId}
                      swapDownTitleId={items[visibleIndex + 1]?.titleId}
                      removeAction={removeFromWatchlist.bind(null, item.titleId)}
                      preferredPlatforms={userPlatforms}
                    />
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      )}
    </div>
  );
}

const SearchIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className="h-5 w-5"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    aria-hidden="true"
  >
    <circle cx="11" cy="11" r="5.5" />
    <path strokeLinecap="round" d="m15.5 15.5 4 4" />
  </svg>
);
