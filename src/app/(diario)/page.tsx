import { Suspense } from "react";
import { DiaryGenreToggle } from "@/components/DiaryGenreToggle";
import { DiaryModeToggle } from "@/components/DiaryModeToggle";
import { CatalogFilters } from "@/components/CatalogFilters";
import { HISTORIAL_DEFAULT_VIEW, type DeckViewMode } from "@/lib/diary-view";
import { DiaryCalendar } from "@/components/DiaryCalendar";
import { DiaryViewHeader } from "@/components/DiaryViewHeader";
import { EmptyState } from "@/components/EmptyState";
import {
  MinePlatformsEmpty,
  MinePlatformsSetupCta,
  MissingStreamingDataNote,
} from "@/components/MinePlatformsNotice";
import { DiaryRouteSkeletonFallback } from "@/components/DiaryRouteSkeleton";
import { DiaryBodySkeleton } from "@/components/PageSkeletons";
import { PageHeader } from "@/components/PageHeader";
import { TitleDeckView } from "@/components/TitleDeckView";
import { scheduleDiaryWatchlistEnrichment } from "@/lib/diary-enrich";
import {
  assignExclusiveDiaryPicks,
  diaryHref,
  parseCategorySlug,
  parseDiaryMode,
  rankDiaryPicks,
  resolveDiaryCategory,
} from "@/lib/diary-picks";
import {
  hasExplicitMonthParam,
  latestMonthWithEntries,
  parseDayParam,
  parseMonthParam,
  titlesInMonth,
} from "@/lib/dates";
import {
  getLatestWatchedMonth,
  getTagFilters,
  getTitles,
  getUserStreamingPlatforms,
  getWatchlist,
} from "@/lib/queries";
import { parseSeriesStatusFilter } from "@/lib/series";
import {
  parseCatalogOrder,
  parseKindFilter,
  parsePlatformFilters,
  sortCatalogItems,
  titleMatchesKind,
} from "@/lib/catalog-filters";
import { applyMinePlatformsFilter, formatUserPlatformsList, resolveCatalogAvailability } from "@/lib/streaming-platforms";
import { catalogHref, parseMinePlatforms, parseTagSlugs } from "@/lib/tags";

export const dynamic = "force-dynamic";

const isView = (value: string | undefined): value is DeckViewMode =>
  value === "deck" || value === "grid" || value === "calendar";

type HomeSearchParams = {
  mode?: string | string[];
  view?: string;
  categoria?: string | string[];
  tag?: string | string[];
  minePlatforms?: string | string[];
  seriesStatus?: string | string[];
  month?: string | string[];
  day?: string | string[];
  kind?: string | string[];
  platform?: string | string[];
  sort?: string | string[];
};

export default function HomePage({
  searchParams,
}: {
  searchParams: Promise<HomeSearchParams>;
}) {
  return (
    <Suspense fallback={<DiaryRouteSkeletonFallback />}>
      <HomeShell searchParams={searchParams} />
    </Suspense>
  );
}

const HomeShell = async ({
  searchParams,
}: {
  searchParams: Promise<HomeSearchParams>;
}) => {
  const params = await searchParams;
  const mode = parseDiaryMode(params.mode);
  const historialView = isView(params.view) ? params.view : HISTORIAL_DEFAULT_VIEW;
  const bodySkeletonMode =
    mode === "historial"
      ? historialView === "calendar"
        ? "calendar"
        : historialView === "grid"
          ? "grid"
          : "deck"
      : "picks";

  return (
    <div
      className={
        mode === "historial"
          ? "space-y-6"
          : "flex min-h-0 flex-1 flex-col gap-2 sm:gap-3 max-sm:-mt-1"
      }
    >
      <div className="shrink-0">
        <DiaryModeToggle mode={mode} />
      </div>
      <Suspense
        fallback={
          <DiaryBodySkeleton
            mode={bodySkeletonMode}
            label={mode === "historial" ? "Cargando historial" : "Cargando diario"}
          />
        }
      >
        {mode === "historial" ? (
          <HistorialHome params={params} />
        ) : (
          <PicksHome categoria={params.categoria} />
        )}
      </Suspense>
    </div>
  );
};

const PicksHome = async ({
  categoria,
}: {
  categoria?: string | string[];
}) => {
  const categorySlug = parseCategorySlug(categoria);

  const [watchlist, userPlatforms] = await Promise.all([
    getWatchlist(),
    getUserStreamingPlatforms(),
  ]);

  const rawTitles = watchlist?.items.map((item) => item.title) ?? [];
  scheduleDiaryWatchlistEnrichment(rawTitles);

  if (userPlatforms.length === 0) {
    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow="Diario"
          title="Qué ver"
          description="Cinco picks de Quiero ver, en mazo, de las categorías que ya tienes y solo en las plataformas que contrataste."
        />
        <EmptyState
          title="Elige tus plataformas"
          description="El Diario solo muestra títulos incluidos en tus suscripciones de México. Indica cuáles tienes en el perfil."
          actionHref="/perfil"
          actionLabel="Ir a perfil"
        />
      </div>
    );
  }

  const catalog = applyMinePlatformsFilter(rawTitles, userPlatforms);
  const titles = catalog.visible.filter((title) => title.watchedAt == null);
  const { categories, picksByCategoryId } = assignExclusiveDiaryPicks(titles);
  const activeCategory = resolveDiaryCategory(categories, categorySlug);
  const picks = activeCategory
    ? (picksByCategoryId.get(activeCategory.id) ?? [])
    : rankDiaryPicks(titles);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1.5 sm:gap-3">
      {activeCategory ? (
        <div className="shrink-0">
          <DiaryGenreToggle
            categories={categories}
            activeSlug={activeCategory.slug}
          />
        </div>
      ) : null}

      {rawTitles.length === 0 ? (
        <EmptyState
          variant="watchlist"
          title="Aún no hay nada en Quiero ver"
          description="Añade títulos desde Buscar o desde una ficha."
          actionHref="/buscar"
          actionLabel="Ir a Buscar"
        />
      ) : titles.length === 0 ? (
        <EmptyState
          title="Nada en tus plataformas"
          description={`Qué ver solo muestra lo incluido (suscripción) en ${formatUserPlatformsList(userPlatforms)}. Renta y compra no cuentan.`}
          actionHref="/perfil"
          actionLabel="Revisar plataformas"
        />
      ) : picks.length === 0 ? (
        <EmptyState
          title="Nada en esta categoría"
          description="Prueba otra pestaña o agrega más títulos a Quiero ver."
          actionHref={diaryHref(categories[0]?.slug)}
          actionLabel="Ver otra categoría"
        />
      ) : (
        <TitleDeckView
          titles={picks}
          mode="deck"
          showToggle={false}
          userPlatforms={userPlatforms}
          footer="watched"
        />
      )}
    </div>
  );
};

const HistorialHome = async ({
  params,
}: {
  params: {
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
}) => {
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
    catalogHref("/", {
      tags: selectedTags,
      view: mode,
      defaultView: HISTORIAL_DEFAULT_VIEW,
      mode: "historial",
      minePlatforms,
      seriesStatus,
      month,
      day: mode === "calendar" ? selectedDay : undefined,
      ...queryExtra,
    });
  const clearHref = catalogHref("/", {
    view,
    defaultView: HISTORIAL_DEFAULT_VIEW,
    mode: "historial",
    month,
    day: view === "calendar" ? selectedDay : undefined,
  });
  const monthCountLabel =
    monthTitles.length === 1 ? "1 entrada" : `${monthTitles.length} entradas`;

  return (
    <div className="space-y-4">
      <DiaryViewHeader
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
        pathname="/"
        view={view}
        defaultView={HISTORIAL_DEFAULT_VIEW}
        mode="historial"
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
