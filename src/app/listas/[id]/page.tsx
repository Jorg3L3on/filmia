import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { deleteList } from "@/app/actions/lists";
import { AddTitleToListCta } from "@/components/AddTitleToListCta";
import { CatalogFilters } from "@/components/CatalogFilters";
import { Button } from "@/components/Button";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { EmptyState } from "@/components/EmptyState";
import { ListTitlesView } from "@/components/ListTitlesView";
import {
  MinePlatformsEmpty,
  MinePlatformsSetupCta,
  MissingStreamingDataNote,
} from "@/components/MinePlatformsNotice";
import { ListsBodySkeleton } from "@/components/PageSkeletons";
import { PageHeader } from "@/components/PageHeader";
import type { DeckViewMode } from "@/components/DeckViewToggle";
import {
  parseCatalogOrder,
  parseKindFilter,
  parsePlatformFilters,
  sortCatalogByTitle,
  titleMatchesKind,
} from "@/lib/catalog-filters";
import { emptyStateForList, isFixedListSlug, WATCHLIST_SLUG } from "@/lib/lists";
import { getListById, getTagFilters, getTitleOptions, getUserStreamingPlatforms } from "@/lib/queries";
import { resolveCatalogAvailability } from "@/lib/streaming-platforms";
import { catalogHref, parseMinePlatforms, parseTagSlugs, titleMatchesAnyTag } from "@/lib/tags";
import { parseSeriesStatusFilter, titleMatchesSeriesStatus } from "@/lib/series";
import { btnDanger } from "@/lib/ui";

export const dynamic = "force-dynamic";

export default function ListDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    view?: string;
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
    view?: string;
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
  const view: DeckViewMode = query.view === "grid" ? "grid" : "deck";
  const selectedTags = parseTagSlugs(query.tag);
  const minePlatforms = parseMinePlatforms(query.minePlatforms);
  const seriesStatus = parseSeriesStatusFilter(query.seriesStatus);
  const kindFilter = parseKindFilter(query.kind);
  const platforms = parsePlatformFilters(query.platform);
  const sort = parseCatalogOrder(query.sort);
  const [list, titleOptions, tags, userPlatforms] = await Promise.all([
    getListById(id),
    getTitleOptions(),
    getTagFilters(),
    getUserStreamingPlatforms(),
  ]);

  if (!list) {
    notFound();
  }

  if (list.kind === "WATCHLIST" || list.slug === WATCHLIST_SLUG) {
    redirect("/watchlist");
  }

  const memberIds = new Set(list.items.map((item) => item.titleId));
  const availableTitles = titleOptions.filter((title) => !memberIds.has(title.id));
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
  const deleteAction = deleteList.bind(null, list.id);
  const fixed = isFixedListSlug(list.slug);
  const empty = emptyStateForList(list.slug);
  const filteredEmpty = list.items.length > 0 && visibleItems.length === 0;
  const clearHref = catalogHref(`/listas/${list.id}`, { view });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={fixed ? "Lista diaria" : "Lista"}
        title={list.name}
        description={list.description ?? undefined}
        actions={
          <>
            <Button href={`/listas/${list.id}/editar`}>
              {fixed ? "Editar descripción" : "Editar"}
            </Button>
            {fixed ? null : (
              <ConfirmSubmit
                label="Borrar lista"
                confirmMessage={`¿Borrar la lista “${list.name}”?`}
                className={btnDanger}
                href="/listas"
                action={deleteAction}
              />
            )}
          </>
        }
      />

      <CatalogFilters
        tags={tags}
        selectedSlugs={selectedTags}
        pathname={`/listas/${list.id}`}
        view={view}
        kind={kindFilter}
        platforms={platforms}
        sort={sort ?? undefined}
        minePlatforms={minePlatforms}
        hasStreamingPlatforms={userPlatforms.length > 0}
        seriesStatus={seriesStatus}
      />

      <AddTitleToListCta listId={list.id} titles={availableTitles} />

      {list.items.length === 0 ? (
        <EmptyState
          variant={empty.variant}
          title={empty.title}
          description={empty.description}
          actionHref={empty.actionHref}
          actionLabel={empty.actionLabel}
        />
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
            mode={view}
            selectedTags={selectedTags}
            minePlatforms={minePlatforms}
            seriesStatus={seriesStatus}
            kind={kindFilter}
            platforms={platforms}
            sort={sort}
          />
        </div>
      )}
    </div>
  );
}
