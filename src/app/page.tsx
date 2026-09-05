import { ViewTransition } from "react";
import { DiaryAddTitleFab } from "@/components/DiaryAddTitleFab";
import { DiaryGenreToggle } from "@/components/DiaryGenreToggle";
import { DiaryModeToggle } from "@/components/DiaryModeToggle";
import { CatalogFilters } from "@/components/CatalogFilters";
import { type DeckViewMode } from "@/components/DeckViewToggle";
import { DiaryCalendar } from "@/components/DiaryCalendar";
import { DiaryMonthList } from "@/components/DiaryMonthList";
import { DiaryViewHeader } from "@/components/DiaryViewHeader";
import { EmptyState } from "@/components/EmptyState";
import {
  MinePlatformsEmpty,
  MinePlatformsSetupCta,
  MissingStreamingDataNote,
} from "@/components/MinePlatformsNotice";
import { PageHeader } from "@/components/PageHeader";
import { TitleDeckView } from "@/components/TitleDeckView";
import { ensureCurrentUserWatchlist } from "@/app/actions/watchlist";
import { enrichDiaryWatchlistTitles } from "@/lib/diary-enrich";
import {
  diaryHref,
  parseCategorySlug,
  parseDiaryMode,
  pickDiaryCategories,
  resolveDiaryCategory,
  titlesForDiaryCategory,
} from "@/lib/diary-picks";
import { parseDayParam, parseMonthParam, titlesInMonth } from "@/lib/dates";
import { metadataServicesConfigured } from "@/lib/metadata";
import { DIARY_STAGE_NAME } from "@/lib/motion-ids";
import {
  getTags,
  getTitles,
  getUserStreamingPlatforms,
  getUserTmdbIndex,
  getWatchlist,
} from "@/lib/queries";
import { parseSeriesStatusFilter } from "@/lib/series";
import { applyMinePlatformsFilter, resolveMinePlatformsCatalog } from "@/lib/streaming-platforms";
import { catalogHref, parseMinePlatforms, parseTagSlugs } from "@/lib/tags";

export const dynamic = "force-dynamic";

const isView = (value: string | undefined): value is DeckViewMode =>
  value === "deck" || value === "grid" || value === "calendar";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{
    mode?: string | string[];
    view?: string;
    categoria?: string | string[];
    tag?: string | string[];
    minePlatforms?: string | string[];
    seriesStatus?: string | string[];
    month?: string | string[];
    day?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const mode = parseDiaryMode(params.mode);

  if (mode === "historial") {
    return <HistorialHome params={params} />;
  }

  return <PicksHome categoria={params.categoria} />;
}

const PicksHome = async ({
  categoria,
}: {
  categoria?: string | string[];
}) => {
  await ensureCurrentUserWatchlist();

  const categorySlug = parseCategorySlug(categoria);
  const metadataConfig = metadataServicesConfigured();

  const [watchlist, userPlatforms, existing] = await Promise.all([
    getWatchlist(),
    getUserStreamingPlatforms(),
    getUserTmdbIndex(),
  ]);

  const rawTitles = watchlist?.items.map((item) => item.title) ?? [];
  const fab = (
    <DiaryAddTitleFab configured={metadataConfig} existing={existing} />
  );
  const modeToggle = <DiaryModeToggle mode="picks" />;

  if (userPlatforms.length === 0) {
    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow="Diario"
          title="Qué ver"
          description="Cinco picks de Quiero ver, en mazo, de las categorías que ya tienes y solo en las plataformas que contrataste."
          actions={modeToggle}
        />
        <EmptyState
          title="Elige tus plataformas"
          description="El Diario solo muestra títulos incluidos en tus suscripciones de México. Indica cuáles tienes en el perfil."
          actionHref="/perfil"
          actionLabel="Ir a perfil"
        />
        {fab}
      </div>
    );
  }

  const enrichedTitles = await enrichDiaryWatchlistTitles(rawTitles);
  const catalog = applyMinePlatformsFilter(enrichedTitles, userPlatforms);
  const titles = catalog.visible;
  const categories = pickDiaryCategories(titles);
  const activeCategory = resolveDiaryCategory(categories, categorySlug);
  const picks = activeCategory
    ? titlesForDiaryCategory(titles, activeCategory.id)
    : [];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Diario"
        title="Qué ver"
        description="Hasta cinco títulos de Quiero ver por categoría, los mejor calificados en IMDb y disponibles en tus plataformas."
        actions={
          <div className="flex flex-wrap items-center justify-end gap-3">
            {modeToggle}
            {activeCategory ? (
              <DiaryGenreToggle
                categories={categories}
                activeSlug={activeCategory.slug}
              />
            ) : null}
          </div>
        }
      />

      <MissingStreamingDataNote count={catalog.missingCache} />

      {rawTitles.length === 0 ? (
        <EmptyState
          title="Quiero ver está vacío"
          description="Usa el botón de abajo a la derecha para buscar un título en TMDB y agregarlo a Quiero ver."
        />
      ) : titles.length === 0 ? (
        <EmptyState
          title="Nada en tus plataformas"
          description="Hay títulos en Quiero ver, pero ninguno está incluido (suscripción) en las plataformas que elegiste."
          actionHref="/perfil"
          actionLabel="Revisar plataformas"
        />
      ) : !activeCategory ? (
        <EmptyState
          title="Sin categorías todavía"
          description="Esos títulos no tienen género de TMDB. Agrégalos de nuevo desde el buscador o espera a que se enriquezcan."
          actionHref="/buscar"
          actionLabel="Buscar en TMDB"
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
          heading={activeCategory.name}
          titles={picks}
          mode="deck"
          showToggle={false}
        />
      )}

      {fab}
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
  };
}) => {
  const view = isView(params.view) ? params.view : "calendar";
  const selectedTags = parseTagSlugs(params.tag);
  const minePlatforms = parseMinePlatforms(params.minePlatforms);
  const seriesStatus = parseSeriesStatusFilter(params.seriesStatus);
  const month = parseMonthParam(params.month);
  const selectedDay = parseDayParam(params.day, month);

  const [taggedTitles, tags, userPlatforms] = await Promise.all([
    getTitles({
      sort: "watched",
      onlyWatched: true,
      tags: selectedTags,
      seriesStatus,
    }),
    getTags(),
    getUserStreamingPlatforms(),
  ]);

  const catalog = resolveMinePlatformsCatalog(
    taggedTitles,
    minePlatforms,
    userPlatforms,
  );
  const titles = catalog.titles;
  const monthTitles = titlesInMonth(titles, month);
  const hasActiveFilters =
    selectedTags.length > 0 || minePlatforms || Boolean(seriesStatus);
  const hrefFor = (mode: DeckViewMode) =>
    catalogHref("/", {
      tags: selectedTags,
      view: mode,
      defaultView: "calendar",
      mode: "historial",
      minePlatforms,
      seriesStatus,
      month,
      day: mode === "calendar" ? selectedDay : undefined,
    });
  const clearHref = catalogHref("/", {
    view,
    defaultView: "calendar",
    mode: "historial",
    month,
    day: view === "calendar" ? selectedDay : undefined,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Diario"
        title="Historial"
        description="Tu diario personal: lo que ya viste, por mes. Sin feed social."
        actions={<DiaryModeToggle mode="historial" />}
      />

      {view === "calendar" ? null : (
        <DiaryViewHeader
          month={month}
          view={view}
          hrefFor={hrefFor}
          tags={selectedTags}
          minePlatforms={minePlatforms}
          seriesStatus={seriesStatus}
        />
      )}

      {catalog.needsSetup ? <MinePlatformsSetupCta /> : null}

      <ViewTransition
        name={DIARY_STAGE_NAME}
        default="none"
        enter="diary-morph"
        exit="diary-morph"
        share="diary-morph"
      >
        <div className="space-y-6">
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
                  titles={titles}
                  month={month}
                  selectedDay={selectedDay}
                  tags={selectedTags}
                  minePlatforms={minePlatforms}
                  seriesStatus={seriesStatus}
                  hasActiveFilters={hasActiveFilters}
                  clearHref={clearHref}
                  hrefFor={hrefFor}
                />
              )}
              <DiaryMonthList titles={titles} month={month} />
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
              title={
                selectedTags.length > 0 || seriesStatus
                  ? "Nada con esos filtros"
                  : "El diario está vacío"
              }
              description={
                selectedTags.length > 0 || seriesStatus
                  ? "Prueba otra combinación o quita filtros. El estado de serie ignora películas."
                  : "Registra un título o corre el seed para ver tus posters."
              }
              actionHref={hasActiveFilters ? clearHref : "/buscar"}
              actionLabel={hasActiveFilters ? "Quitar filtros" : "Buscar en TMDB"}
            />
          ) : (
            <>
              <MissingStreamingDataNote count={catalog.missingCache} />
              <TitleDeckView
                heading={view === "deck" ? "Mazo" : "Cuadrícula"}
                titles={monthTitles.length > 0 ? monthTitles : titles}
                mode={view}
                showToggle={false}
              />
            </>
          )}
        </div>
      </ViewTransition>

      <CatalogFilters
        tags={tags}
        selectedSlugs={selectedTags}
        pathname="/"
        view={view}
        defaultView="calendar"
        mode="historial"
        minePlatforms={minePlatforms}
        hasStreamingPlatforms={userPlatforms.length > 0}
        seriesStatus={seriesStatus}
        month={month}
        day={selectedDay}
      />
    </div>
  );
};
