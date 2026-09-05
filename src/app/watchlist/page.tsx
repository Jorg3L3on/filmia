import Link from "next/link";
import { TitleKind } from "@/generated/prisma/browser";
import { ensureCurrentUserWatchlist, removeFromWatchlist } from "@/app/actions/watchlist";
import { EmptyState } from "@/components/EmptyState";
import {
  MinePlatformsEmpty,
  MinePlatformsSetupCta,
  MissingStreamingDataNote,
} from "@/components/MinePlatformsNotice";
import { WatchlistCard } from "@/components/WatchlistCard";
import { getUserStreamingPlatforms, getWatchlist } from "@/lib/queries";
import { resolveMinePlatformsCatalog } from "@/lib/streaming-platforms";
import { catalogHref, parseMinePlatforms } from "@/lib/tags";
import { cn } from "@/lib/cn";
import { btnPrimary, focusRing } from "@/lib/ui";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Quiero ver",
};

const KIND_CHIPS = [
  { value: "ALL", label: "Todos" },
  { value: TitleKind.MOVIE, label: "Películas" },
  { value: TitleKind.SERIES, label: "Series" },
] as const;

const parseKindFilter = (value: unknown) => {
  const raw = Array.isArray(value) ? value.at(-1) : value;
  return raw === TitleKind.MOVIE || raw === TitleKind.SERIES ? raw : "ALL";
};

const kindHref = (kind: (typeof KIND_CHIPS)[number]["value"]) =>
  kind === "ALL" ? "/watchlist" : `/watchlist?kind=${kind}`;

export default async function WatchlistPage({
  searchParams,
}: {
  searchParams: Promise<{
    kind?: string | string[];
    minePlatforms?: string | string[];
  }>;
}) {
  await ensureCurrentUserWatchlist();
  const params = await searchParams;
  const kindFilter = parseKindFilter(params.kind);
  const minePlatforms = parseMinePlatforms(params.minePlatforms);

  const [watchlist, userPlatforms] = await Promise.all([
    getWatchlist(),
    getUserStreamingPlatforms(),
  ]);

  const rawItems = watchlist?.items ?? [];
  const kindItems =
    kindFilter === "ALL"
      ? rawItems
      : rawItems.filter((item) => item.title.kind === kindFilter);
  const catalog = resolveMinePlatformsCatalog(
    kindItems.map((item) => item.title),
    minePlatforms,
    userPlatforms,
  );
  const visibleIds = new Set(catalog.titles.map((title) => title.id));
  const items = catalog.needsSetup
    ? []
    : minePlatforms
      ? kindItems.filter((item) => visibleIds.has(item.title.id))
      : kindItems;

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

      <div
        role="group"
        aria-label="Filtro por tipo"
        className="rail flex gap-2 overflow-x-auto"
      >
        {KIND_CHIPS.map((chip) => {
          const isCurrent = kindFilter === chip.value;
          return (
            <Link
              key={chip.value}
              href={kindHref(chip.value)}
              aria-current={isCurrent ? "page" : undefined}
              className={cn(
                "shrink-0 rounded-full px-4 py-2 text-sm font-medium",
                focusRing,
                isCurrent
                  ? "bg-accent text-ink"
                  : "border border-chrome text-fog hover:text-paper",
              )}
            >
              {chip.label}
            </Link>
          );
        })}
      </div>

      {rawItems.length === 0 ? (
        <EmptyState
          title="Nada en Quiero ver"
          description="Agrega títulos que quieras ver pronto."
          actionHref="/buscar"
          actionLabel="Agregar a Quiero ver"
        />
      ) : catalog.needsSetup ? (
        <MinePlatformsSetupCta />
      ) : items.length === 0 && minePlatforms ? (
        <>
          <MissingStreamingDataNote count={catalog.missingCache} />
          <MinePlatformsEmpty
            userPlatforms={userPlatforms}
            actionHref={clearHref}
            hasTagFilters={kindFilter !== "ALL"}
          />
        </>
      ) : items.length === 0 ? (
        <EmptyState
          title="Nada con ese filtro"
          description="Prueba otra pestaña o agrega más títulos."
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
              canMoveDown={kindFilter === "ALL" && queue.length > 0}
              removeAction={removeFromWatchlist.bind(null, hero.titleId)}
            />
          ) : null}

          {queue.length > 0 ? (
            <ul className="divide-y divide-line">
              {queue.map((item, index) => (
                <li key={item.titleId}>
                  <WatchlistCard
                    item={item}
                    variant="queue"
                    position={index + 2}
                    listId={listId}
                    canMoveUp={kindFilter === "ALL"}
                    canMoveDown={kindFilter === "ALL" && index < queue.length - 1}
                    removeAction={removeFromWatchlist.bind(null, item.titleId)}
                  />
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}

      <div className="sticky bottom-20 z-20 bg-canvas/95 py-3 sm:bottom-4">
        <Link href="/buscar" className={`${btnPrimary} w-full`}>
          + Agregar a Quiero ver
        </Link>
      </div>
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
