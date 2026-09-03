import Link from "next/link";
import {
  addToWatchlistFromForm,
  ensureCurrentUserWatchlist,
  removeFromWatchlist,
  updateWatchlistNote,
} from "@/app/actions/watchlist";
import { CatalogFilters } from "@/components/CatalogFilters";
import { EmptyState } from "@/components/EmptyState";
import {
  MinePlatformsEmpty,
  MinePlatformsSetupCta,
  MissingStreamingDataNote,
} from "@/components/MinePlatformsNotice";
import { PageHeader } from "@/components/PageHeader";
import { WatchlistCard } from "@/components/WatchlistCard";
import { TitlePosterRail } from "@/components/TitlePosterRail";
import {
  getTags,
  getTitleOptions,
  getUserStreamingPlatforms,
  getWatchlist,
} from "@/lib/queries";
import { resolveMinePlatformsCatalog } from "@/lib/streaming-platforms";
import { catalogHref, parseMinePlatforms, parseTagSlugs, titleMatchesAnyTag } from "@/lib/tags";
import { parseSeriesStatusFilter, titleMatchesSeriesStatus } from "@/lib/series";
import { btnGhost, btnPrimary, fieldClass } from "@/lib/ui";
import { WATCHLIST_DESCRIPTION, WATCHLIST_NAME } from "@/lib/watchlist";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Quiero ver",
};

export default async function WatchlistPage({
  searchParams,
}: {
  searchParams: Promise<{
    tag?: string | string[];
    minePlatforms?: string | string[];
    seriesStatus?: string | string[];
  }>;
}) {
  await ensureCurrentUserWatchlist();
  const params = await searchParams;
  const selectedTags = parseTagSlugs(params.tag);
  const minePlatforms = parseMinePlatforms(params.minePlatforms);
  const seriesStatus = parseSeriesStatusFilter(params.seriesStatus);

  const [watchlist, titleOptions, tags, userPlatforms] = await Promise.all([
    getWatchlist(),
    getTitleOptions(),
    getTags(),
    getUserStreamingPlatforms(),
  ]);

  const rawItems = watchlist?.items ?? [];
  const taggedItems =
    selectedTags.length > 0
      ? rawItems.filter((item) => titleMatchesAnyTag(item.title.tags, selectedTags))
      : rawItems;
  const statusItems = taggedItems.filter((item) =>
    titleMatchesSeriesStatus(item.title, seriesStatus),
  );
  const catalog = resolveMinePlatformsCatalog(
    statusItems.map((item) => item.title),
    minePlatforms,
    userPlatforms,
  );
  const visibleIds = new Set(catalog.titles.map((title) => title.id));
  const items = catalog.needsSetup
    ? []
    : minePlatforms
      ? statusItems.filter((item) => visibleIds.has(item.title.id))
      : statusItems;

  const listId = watchlist?.id ?? "";
  const memberIds = new Set(rawItems.map((item) => item.titleId));
  const availableTitles = titleOptions.filter((title) => !memberIds.has(title.id));
  const [hero, ...queue] = items;
  const hasActiveFilters = selectedTags.length > 0 || minePlatforms || Boolean(seriesStatus);
  const clearHref = catalogHref("/watchlist");

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Lista diaria"
        title={WATCHLIST_NAME}
        description={WATCHLIST_DESCRIPTION}
        actions={
          watchlist ? (
            <Link href={`/listas/${watchlist.id}/editar`} className={btnGhost}>
              Editar descripción
            </Link>
          ) : null
        }
      />
      <p className="text-xs text-mist">
        {hasActiveFilters
          ? `${items.length} de ${rawItems.length} ${
              rawItems.length === 1 ? "título en cola" : "títulos en cola"
            }`
          : `${rawItems.length} ${
              rawItems.length === 1 ? "título en cola" : "títulos en cola"
            }`}
      </p>

      <CatalogFilters
        tags={tags}
        selectedSlugs={selectedTags}
        pathname="/watchlist"
        minePlatforms={minePlatforms}
        hasStreamingPlatforms={userPlatforms.length > 0}
        seriesStatus={seriesStatus}
      />

      <form
        action={addToWatchlistFromForm}
        className="flex flex-wrap items-end gap-3 rounded-md border border-line bg-well p-5"
      >
        <label className="block min-w-56 flex-1 space-y-1">
          <span className="text-xs uppercase tracking-wide text-fog">
            Agregar a la cola
          </span>
          <select name="titleId" required className={fieldClass}>
            <option value="">Elige un título</option>
            {availableTitles.map((title) => (
              <option key={title.id} value={title.id}>
                {title.name}
                {title.year ? ` (${title.year})` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="block min-w-48 flex-1 space-y-1">
          <span className="text-xs uppercase tracking-wide text-fog">
            Nota (opcional)
          </span>
          <input
            name="queueNote"
            placeholder="Recomendación, mood, etc."
            className={fieldClass}
          />
        </label>
        <button type="submit" className={btnPrimary}>
          Encolar
        </button>
      </form>

      {rawItems.length === 0 ? (
        <EmptyState
          title="Nada en Quiero ver"
          description="Agrega títulos que quieras ver pronto, o registra uno nuevo."
          actionHref="/buscar"
          actionLabel="Buscar en TMDB"
        />
      ) : catalog.needsSetup ? (
        <MinePlatformsSetupCta />
      ) : items.length === 0 && minePlatforms ? (
        <>
          <MissingStreamingDataNote count={catalog.missingCache} />
          <MinePlatformsEmpty
            userPlatforms={userPlatforms}
            actionHref={clearHref}
            hasTagFilters={selectedTags.length > 0 || Boolean(seriesStatus)}
          />
        </>
      ) : items.length === 0 ? (
        <EmptyState
          title="Nada con esos filtros"
          description="Esta cola no tiene títulos con las etiquetas o el estado de serie elegidos. El estado ignora películas."
          actionHref={clearHref}
          actionLabel="Quitar filtros"
        />
      ) : (
        <div className="space-y-8">
          <MissingStreamingDataNote count={catalog.missingCache} />
          <TitlePosterRail
            title="En cola"
            ariaLabel="Posters de la cola"
            titles={items.slice(0, 12).map((item) => item.title)}
          />
          {hero ? (
            <WatchlistCard
              item={hero}
              variant="hero"
              position={1}
              listId={listId}
              canMoveUp={false}
              canMoveDown={!hasActiveFilters && queue.length > 0}
              removeAction={removeFromWatchlist.bind(null, hero.titleId)}
              updateNoteAction={updateWatchlistNote.bind(null, hero.titleId)}
            />
          ) : null}

          {queue.length > 0 ? (
            <section className="space-y-4">
              <h2 className="text-xs uppercase tracking-[0.2em] text-mist">
                Siguen
              </h2>
              <ul className="space-y-3">
                {queue.map((item, index) => (
                  <li key={item.titleId}>
                    <WatchlistCard
                      item={item}
                      variant="queue"
                      position={index + 2}
                      listId={listId}
                      canMoveUp={!hasActiveFilters}
                      canMoveDown={!hasActiveFilters && index < queue.length - 1}
                      removeAction={removeFromWatchlist.bind(null, item.titleId)}
                      updateNoteAction={updateWatchlistNote.bind(null, item.titleId)}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
