import { Suspense } from "react";
import { CatalogFilters } from "@/components/CatalogFilters";
import { DiaryCalendar } from "@/components/DiaryCalendar";
import { DiaryViewHeader } from "@/components/DiaryViewHeader";
import { EmptyState } from "@/components/EmptyState";
import {
  MinePlatformsEmpty,
  MinePlatformsSetupCta,
  MissingStreamingDataNote,
} from "@/components/MinePlatformsNotice";
import { PageHeader } from "@/components/PageHeader";
import { DiaryBodySkeleton } from "@/components/PageSkeletons";
import { TitleDeckView } from "@/components/TitleDeckView";
import {
  parseCatalogOrder,
  parseKindFilter,
  parsePlatformFilters,
  sortCatalogItems,
  titleMatchesKind,
} from "@/lib/catalog-filters";
import {
  hasExplicitMonthParam,
  latestMonthWithEntries,
  parseDayParam,
  parseMonthParam,
  titlesInMonth,
} from "@/lib/dates";
import { DIARY_HISTORIAL_PATH } from "@/lib/diary-picks";
import { HISTORIAL_DEFAULT_VIEW, type DeckViewMode } from "@/lib/diary-view";
import {
  getLatestWatchedMonth,
  getTagFilters,
  getTitles,
  getUserStreamingPlatforms,
} from "@/lib/queries";
import { parseSeriesStatusFilter } from "@/lib/series";
import { resolveCatalogAvailability } from "@/lib/streaming-platforms";
import { catalogHref, parseMinePlatforms, parseTagSlugs } from "@/lib/tags";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Tu diario",
} as const;

const isView = (value: string | undefined): value is DeckViewMode =>
  value === "deck" || value === "grid" || value === "calendar";

type DiarioSearchParams = {
  view?: string;
  tag?: string | string[];
  minePlatforms?: string | string[];
  seriesStatus?: string | string[];
  month?: string | string[];
  day?: string | string[];
  kind?: string | string[];
  platform?: string | string[];
  sort?: string | string[];
};

/** Tu diario (calendario · mazo · cuadrícula) — reached from Perfil. */
export default function DiarioPage({
  searchParams,
}: {
  searchParams: Promise<DiarioSearchParams>;
}) {
  return (
    <div className="space-y-6">
      <PageHeader title="Tu diario" backHref="/perfil" backLabel="Volver a Perfil" />
      <Suspense fallback={<DiaryBodySkeleton mode="calendar" label="Cargando tu diario" />}>
        <HistorialHome searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

const HistorialHome = async ({
  searchParams,
}: {
  searchParams: Promise<DiarioSearchParams>;
}) => {
  const params = await searchParams;
  const view = isView(params.view) ? params.view : HISTORIAL_DEFAULT_VIEW;
  const selectedTags = parseTagSlugs(params.tag);
  const minePlatforms = parseMinePlatforms(params.minePlatforms);
  const seriesStatus = parseSeriesStatusFilter(params.seriesStatus);
  const kindFilter = parseKindFilter(params.kind);
  const platforms = parsePlatformFilters(params.platform);
  const sort = parseCatalogOrder(params.sort);
  const requestedMonth = parseMonthParam(params.month);
  const explicitMonth = hasExplicitMonthParam(params.month);
  const canScopeMonth = !minePlatforms && platforms.length === 0;
  const titleFilters = {
    sort: "watched" as const,
    onlyWatched: true,
    tags: selectedTags,
    seriesStatus,
    kind: kindFilter,
  };

  let taggedTitles;
  let tags;
  let userPlatforms;
  let latestWatchedMonth: string | null = null;
  let month = requestedMonth;

  if (canScopeMonth && explicitMonth) {
    [taggedTitles, tags, userPlatforms, latestWatchedMonth] = await Promise.all([
      getTitles({ ...titleFilters, watchedMonth: requestedMonth }),
      getTagFilters(),
      getUserStreamingPlatforms(),
      getLatestWatchedMonth(titleFilters),
    ]);
    month = requestedMonth;
  } else if (canScopeMonth) {
    [latestWatchedMonth, tags, userPlatforms] = await Promise.all([
      getLatestWatchedMonth(titleFilters),
      getTagFilters(),
      getUserStreamingPlatforms(),
    ]);
    month = latestWatchedMonth ?? requestedMonth;
    taggedTitles = await getTitles({ ...titleFilters, watchedMonth: month });
  } else {
    [taggedTitles, tags, userPlatforms] = await Promise.all([
      getTitles(titleFilters),
      getTagFilters(),
      getUserStreamingPlatforms(),
    ]);
  }

  const kindTitles = taggedTitles.filter((title) =>
    titleMatchesKind(title.kind, kindFilter),
  );
  const catalog = resolveCatalogAvailability(kindTitles, {
    platforms,
    minePlatforms,
    userPlatforms,
  });
  const titles = sortCatalogItems(catalog.titles, sort);
  if (!canScopeMonth) {
    month = explicitMonth
      ? requestedMonth
      : latestMonthWithEntries(titles, requestedMonth);
  }
  const selectedDay = parseDayParam(params.day, month);
  const monthTitles = titlesInMonth(titles, month);
  const hasAnyTitles = canScopeMonth
    ? Boolean(latestWatchedMonth)
    : titles.length > 0;
  const hasActiveFilters =
    selectedTags.length > 0 ||
    minePlatforms ||
    Boolean(seriesStatus) ||
    kindFilter !== "ALL" ||
    platforms.length > 0 ||
    Boolean(sort);
  const queryExtra = {
    kind: kindFilter,
    platforms,
    sort,
  };
  const hrefFor = (mode: DeckViewMode) =>
    catalogHref(DIARY_HISTORIAL_PATH, {
      tags: selectedTags,
      view: mode,
      defaultView: HISTORIAL_DEFAULT_VIEW,
      minePlatforms,
      seriesStatus,
      month,
      day: mode === "calendar" ? selectedDay : undefined,
      ...queryExtra,
    });
  const clearHref = catalogHref(DIARY_HISTORIAL_PATH, {
    view,
    defaultView: HISTORIAL_DEFAULT_VIEW,
    month,
    day: view === "calendar" ? selectedDay : undefined,
  });
  const monthCountLabel =
    monthTitles.length === 1 ? "1 entrada" : `${monthTitles.length} entradas`;

  return (
    <div className="space-y-4">
      <DiaryViewHeader
        pathname={DIARY_HISTORIAL_PATH}
        month={month}
        view={view}
        hrefFor={hrefFor}
        countLabel={monthCountLabel}
        tags={selectedTags}
        minePlatforms={minePlatforms}
        seriesStatus={seriesStatus}
        kind={kindFilter}
        platforms={platforms}
        sort={sort}
      />

      {catalog.needsSetup ? <MinePlatformsSetupCta /> : null}

      <CatalogFilters
        tags={tags}
        selectedSlugs={selectedTags}
        pathname={DIARY_HISTORIAL_PATH}
        view={view}
        defaultView={HISTORIAL_DEFAULT_VIEW}
        minePlatforms={minePlatforms}
        hasStreamingPlatforms={userPlatforms.length > 0}
        seriesStatus={seriesStatus}
        month={month}
        day={selectedDay}
        kind={kindFilter}
        platforms={platforms}
        sort={sort ?? undefined}
      />

      <div className="diary-stage space-y-5">
        {catalog.needsSetup ? null : view === "calendar" ? (
          <>
            <MissingStreamingDataNote count={catalog.missingCache} />
            {titles.length === 0 && minePlatforms ? (
              <MinePlatformsEmpty
                userPlatforms={userPlatforms}
                actionHref={clearHref}
                hasTagFilters={selectedTags.length > 0 || Boolean(seriesStatus)}
              />
            ) : (
              <DiaryCalendar
                titles={monthTitles}
                month={month}
                selectedDay={selectedDay}
                tags={selectedTags}
                minePlatforms={minePlatforms}
                seriesStatus={seriesStatus}
                kind={kindFilter}
                platforms={platforms}
                sort={sort}
                hasActiveFilters={hasActiveFilters}
                hasAnyTitles={hasAnyTitles}
                clearHref={clearHref}
              />
            )}
          </>
        ) : titles.length === 0 && minePlatforms ? (
          <>
            <MissingStreamingDataNote count={catalog.missingCache} />
            <MinePlatformsEmpty
              userPlatforms={userPlatforms}
              actionHref={clearHref}
              hasTagFilters={selectedTags.length > 0 || Boolean(seriesStatus)}
            />
          </>
        ) : titles.length === 0 ? (
          <EmptyState
            variant="historial"
            title={
              hasActiveFilters
                ? "Nada con esos filtros"
                : "Tu historial está vacío"
            }
            description={
              hasActiveFilters
                ? "Prueba otra combinación o quita filtros. El estado de serie ignora películas."
                : "Registra lo que viste y aparecerá en el mazo."
            }
            actionHref={hasActiveFilters ? clearHref : "/buscar?destino=visto"}
            actionLabel={hasActiveFilters ? "Quitar filtros" : "Buscar título"}
          />
        ) : (
          <>
            <MissingStreamingDataNote count={catalog.missingCache} />
            <TitleDeckView
              titles={monthTitles.length > 0 ? monthTitles : titles}
              mode={view}
              showToggle={false}
              userPlatforms={userPlatforms}
            />
          </>
        )}
      </div>
    </div>
  );
};
